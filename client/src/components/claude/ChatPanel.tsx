import { useState, useRef, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { useActiveProvider, type ChatMessage } from '@/hooks/useAiProvider'
import { AiProviderConfigDialog } from './AiProviderConfigDialog'
import { Send, Settings, Loader2, ChevronDown, ChevronRight, Trash2, Sparkles, ShieldCheck } from 'lucide-react'
import { cn } from '@/lib/utils'
import { playAiCompleteSound } from '@/lib/sounds'
import { api } from '@/lib/api'
import Markdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeRaw from 'rehype-raw'

interface ChatPanelProps {
  projectId: string
}

export function ChatPanel({ projectId }: ChatPanelProps) {
  const activeProvider = useActiveProvider()
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [isStreaming, setIsStreaming] = useState(false)
  const [isCollapsed, setIsCollapsed] = useState(false)
  const [configOpen, setConfigOpen] = useState(false)
  const [pendingToolCalls, setPendingToolCalls] = useState<Array<{ name: string; args: Record<string, any>; preview?: string }> | null>(null)
  const [safeMode, setSafeMode] = useState(() => {
    try { return localStorage.getItem('shipyard:ai-safe-mode') !== 'false' } catch { return true }
  })
  const [toolHistory, setToolHistory] = useState<Array<{ time: string; name: string; ok: boolean; summary?: string }>>([])
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const historyKey = `shipyard:ai-tool-history:${projectId}`

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [])

  useEffect(() => {
    scrollToBottom()
  }, [messages, scrollToBottom])

  useEffect(() => {
    try {
      const raw = localStorage.getItem(historyKey)
      if (raw) setToolHistory(JSON.parse(raw))
      else setToolHistory([])
    } catch {
      setToolHistory([])
    }
  }, [historyKey])

  const persistHistory = (next: Array<{ time: string; name: string; ok: boolean; summary?: string }>) => {
    setToolHistory(next)
    try { localStorage.setItem(historyKey, JSON.stringify(next.slice(-100))) } catch {}
  }

  const appendToolHistory = (calls: Array<{ name: string; ok: boolean; args?: any; result?: any }>) => {
    if (!calls || calls.length === 0) return
    const now = new Date().toISOString()
    const entries = calls.map(c => {
      let summary = ''
      if (c.name === 'write_file') summary = c.args?.path
      else if (c.name === 'rename_file') summary = `${c.args?.path} → ${c.args?.newName}`
      else if (c.name === 'delete_file') summary = c.args?.path
      else if (c.name === 'open_file') summary = c.args?.path
      else if (c.name === 'git_commit') summary = c.args?.message
      else if (c.name === 'get_git_diff') summary = c.args?.file ? c.args.file : 'working tree'
      else if (c.name === 'search_files' || c.name === 'search_content') summary = c.args?.query
      return { time: now, name: c.name, ok: !!c.ok, summary }
    })
    setToolHistory(prev => {
      const next = [...prev, ...entries].slice(-100)
      try { localStorage.setItem(historyKey, JSON.stringify(next)) } catch {}
      return next
    })
  }

  const handleSend = async () => {
    const text = input.trim()
    if (!text || isStreaming) return

    const userMsg: ChatMessage = { role: 'user', content: text }
    const newMessages = [...messages, userMsg]
    setMessages(newMessages)
    setInput('')
    setIsStreaming(true)

    // Placeholder assistant message while waiting
    setMessages([...newMessages, { role: 'assistant', content: '...' }])

    try {
      const result = await api.assistantChat(projectId, newMessages, activeProvider?.id, safeMode)
      const toolNames = Array.from(new Set((result.toolCalls || []).map(t => t.name)))
      const updatedFiles = Array.from(new Set(
        (result.toolCalls || [])
          .filter(t => t.name === 'write_file' && t.ok)
          .map(t => t.args?.path)
          .filter(Boolean)
      ))
      const openedFiles = (result.toolCalls || [])
        .filter(t => t.name === 'open_file' && t.ok)
        .map(t => t.result)
        .filter(Boolean) as Array<{ path: string; name: string; extension: string }>

      const meta: string[] = []
      if (updatedFiles.length > 0) meta.push(`Updated files: ${updatedFiles.join(', ')}`)
      if (toolNames.length > 0) meta.push(`Tools: ${toolNames.join(', ')}`)

      const content = meta.length > 0
        ? `${result.message}\n\n_${meta.join(' · ')}_`
        : result.message

      setMessages(prev => {
        const updated = [...prev]
        updated[updated.length - 1] = { role: 'assistant', content }
        return updated
      })
      appendToolHistory(result.toolCalls || [])
      for (const f of openedFiles) {
        try {
          window.dispatchEvent(new CustomEvent('shipyard:open-editor-file', { detail: f }))
        } catch {}
      }
      if (result.pendingToolCalls && result.pendingToolCalls.length > 0) {
        setPendingToolCalls(result.pendingToolCalls)
      } else {
        setPendingToolCalls(null)
      }
      setIsStreaming(false)
      playAiCompleteSound()
    } catch (err: any) {
      setMessages(prev => {
        const updated = [...prev]
        updated[updated.length - 1] = { role: 'assistant', content: `Error: ${err.message || 'Request failed'}` }
        return updated
      })
      setIsStreaming(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const clearChat = () => {
    setMessages([])
    setPendingToolCalls(null)
  }

  const clearHistory = () => {
    persistHistory([])
  }

  const applyPendingTools = async () => {
    if (!pendingToolCalls || pendingToolCalls.length === 0 || isStreaming) return
    setIsStreaming(true)
    try {
      const toolCalls = pendingToolCalls.map(t => ({ name: t.name, args: t.args }))
      const result = await api.assistantApplyTools(projectId, toolCalls)
      const toolNames = Array.from(new Set((result.toolCalls || []).map(t => t.name)))
      const updatedFiles = Array.from(new Set(
        (result.toolCalls || [])
          .filter(t => t.name === 'write_file' && t.ok)
          .map(t => t.args?.path)
          .filter(Boolean)
      ))
      const openedFiles = (result.toolCalls || [])
        .filter(t => t.name === 'open_file' && t.ok)
        .map(t => t.result)
        .filter(Boolean) as Array<{ path: string; name: string; extension: string }>
      const meta: string[] = []
      if (updatedFiles.length > 0) meta.push(`Updated files: ${updatedFiles.join(', ')}`)
      if (toolNames.length > 0) meta.push(`Tools: ${toolNames.join(', ')}`)

      const summary = meta.length > 0
        ? `Changes applied.\n\n_${meta.join(' · ')}_`
        : 'Changes applied.'

      setMessages(prev => [...prev, { role: 'assistant', content: summary }])
      appendToolHistory(result.toolCalls || [])
      for (const f of openedFiles) {
        try {
          window.dispatchEvent(new CustomEvent('shipyard:open-editor-file', { detail: f }))
        } catch {}
      }
      setPendingToolCalls(null)
      setIsStreaming(false)
      playAiCompleteSound()
    } catch (err: any) {
      setMessages(prev => [...prev, { role: 'assistant', content: `Error applying changes: ${err.message || 'Request failed'}` }])
      setIsStreaming(false)
    }
  }

  const aiAvailable = activeProvider?.configured

  if (!aiAvailable) {
    return (
      <div>
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
            <Sparkles className="h-3.5 w-3.5" />
            AI Assistant
          </h3>
          <Button size="sm" variant="ghost" className="h-6 text-[10px] gap-1 text-muted-foreground" onClick={() => setConfigOpen(true)}>
            <Settings className="h-3 w-3" />
            Setup
          </Button>
        </div>
        <AiProviderConfigDialog providerId={activeProvider?.id || 'claude'} open={configOpen} onOpenChange={setConfigOpen} />
      </div>
    )
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <button
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground hover:text-foreground transition-colors"
        >
          {isCollapsed ? <ChevronRight className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
          <Sparkles className="h-3.5 w-3.5" />
          {activeProvider?.name || 'AI Assistant'}
        </button>
        <div className="flex items-center gap-1">
          <label className="flex items-center gap-1 text-[10px] text-muted-foreground mr-1">
            <input
              type="checkbox"
              checked={safeMode}
              onChange={(e) => {
                setSafeMode(e.target.checked)
                try { localStorage.setItem('shipyard:ai-safe-mode', String(e.target.checked)) } catch {}
              }}
              className="rounded border-muted-foreground/30 h-3 w-3"
            />
            <ShieldCheck className="h-3 w-3" />
            Safe mode
          </label>
          <div className="h-1.5 w-1.5 rounded-full bg-green-500" title={`${activeProvider?.name} active`} />
          {pendingToolCalls && pendingToolCalls.length > 0 && (
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-yellow-500/15 text-yellow-400">
              Pending {pendingToolCalls.length}
            </span>
          )}
          {messages.length > 0 && (
            <button onClick={clearChat} className="text-muted-foreground hover:text-foreground p-0.5" title="Clear chat">
              <Trash2 className="h-3 w-3" />
            </button>
          )}
          <button onClick={() => setConfigOpen(true)} className="text-muted-foreground hover:text-foreground p-0.5" title="Settings">
            <Settings className="h-3 w-3" />
          </button>
        </div>
      </div>

      {!isCollapsed && (
        <div className="border rounded-lg overflow-hidden bg-background">
          {/* Messages */}
          <div className="max-h-80 overflow-y-auto p-2 space-y-2 scrollbar-dark">
            {messages.length === 0 && (
              <p className="text-xs text-muted-foreground text-center py-4">
                Ask anything about this project. You can request file edits.
              </p>
            )}
            {messages.map((msg, i) => (
              <div key={i} className={cn(
                'text-xs rounded-lg px-2.5 py-1.5 max-w-[95%]',
                msg.role === 'user'
                  ? 'bg-primary/10 ml-auto text-foreground'
                  : 'bg-muted/50 text-foreground'
              )}>
                {msg.role === 'assistant' ? (
                  <div className="prose prose-xs prose-invert max-w-none [&_p]:mb-1 [&_p]:mt-0 [&_pre]:text-[10px] [&_code]:text-[10px] [&_li]:my-0">
                    <Markdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeRaw]} components={{ a: ({ children, ...props }) => <a {...props} target="_blank" rel="noopener noreferrer">{children}</a> }}>
                      {msg.content || (isStreaming && i === messages.length - 1 ? '...' : '')}
                    </Markdown>
                  </div>
                ) : (
                  <p className="whitespace-pre-wrap">{msg.content}</p>
                )}
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>

          {toolHistory.length > 0 && (
            <div className="border-t p-2 bg-muted/20">
              <div className="flex items-center justify-between">
                <span className="text-[11px] text-muted-foreground">Tool history (latest)</span>
                <button className="text-[10px] text-muted-foreground hover:text-foreground" onClick={clearHistory}>
                  Clear
                </button>
              </div>
              <div className="mt-1 space-y-1">
                {toolHistory.slice(-6).map((h, i) => (
                  <div key={`${h.time}-${i}`} className="text-[10px] text-muted-foreground/80">
                    {h.ok ? '✓' : '×'} {h.name}{h.summary ? ` — ${h.summary}` : ''}
                  </div>
                ))}
              </div>
            </div>
          )}

          {pendingToolCalls && pendingToolCalls.length > 0 && (
            <div className="border-t p-2 bg-muted/30 flex items-start justify-between gap-2">
              <div className="text-[11px] text-muted-foreground">
                <div>Pending changes require confirmation:</div>
                {pendingToolCalls.map((t, i) => (
                  <div key={`${t.name}-${i}`} className="text-[10px] text-muted-foreground/80">
                    {t.name}
                    {t.args?.path ? ` — ${t.args.path}` : ''}
                    {t.args?.message ? ` — ${t.args.message}` : ''}
                    {t.preview && (
                      <pre className="mt-1 max-h-40 overflow-auto text-[10px] bg-background/60 border rounded p-2 whitespace-pre-wrap">
                        {t.preview}
                      </pre>
                    )}
                  </div>
                ))}
              </div>
              <Button size="sm" className="h-7 text-xs" onClick={applyPendingTools} disabled={isStreaming}>
                Apply Changes
              </Button>
            </div>
          )}

          {/* Input */}
          <div className="border-t p-2 flex gap-1.5">
            <Textarea
              ref={textareaRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={`Ask ${activeProvider?.name || 'AI'}...`}
              className="min-h-[32px] max-h-20 text-xs resize-none"
              rows={1}
              disabled={isStreaming}
            />
            <Button
              size="icon"
              variant="ghost"
              onClick={handleSend}
              disabled={!input.trim() || isStreaming}
              className="shrink-0 h-8 w-8"
            >
              {isStreaming ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
            </Button>
          </div>
        </div>
      )}

      <AiProviderConfigDialog providerId={activeProvider?.id || 'claude'} open={configOpen} onOpenChange={setConfigOpen} />
    </div>
  )
}
