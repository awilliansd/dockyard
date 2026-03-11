import { useState, useRef, useCallback, useEffect } from 'react'
import { Plus, X, ChevronDown, ChevronUp, Terminal, Trash2, ExternalLink } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import {
  useTerminalStatus,
  useCreateTerminalSession,
  useKillTerminalSession,
  type TerminalSessionInfo,
} from '@/hooks/useTerminal'
import { useLaunchTerminal } from '@/hooks/useProjects'
import { IntegratedTerminal } from './IntegratedTerminal'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'

interface TerminalPanelProps {
  projectId: string
  projectPath: string
  projectName: string
}

interface LocalTab {
  sessionId: string
  title: string
  type: string
  exited: boolean
}

const PANEL_HEIGHT_KEY = 'devdash:terminal-height'
const PANEL_VISIBLE_KEY = 'devdash:terminal-visible'
const MIN_HEIGHT = 150
const MAX_HEIGHT_RATIO = 0.7
const DEFAULT_HEIGHT = 300

export function TerminalPanel({ projectId, projectPath, projectName }: TerminalPanelProps) {
  const { data: status } = useTerminalStatus()
  const createSession = useCreateTerminalSession()
  const killSession = useKillTerminalSession()
  const launchNative = useLaunchTerminal()

  const [tabs, setTabs] = useState<LocalTab[]>([])
  const [activeTabId, setActiveTabId] = useState<string | null>(null)
  const [panelHeight, setPanelHeight] = useState(() => {
    const saved = localStorage.getItem(PANEL_HEIGHT_KEY)
    return saved ? Math.max(MIN_HEIGHT, parseInt(saved, 10)) : DEFAULT_HEIGHT
  })
  const [isVisible, setIsVisible] = useState(() => {
    return localStorage.getItem(PANEL_VISIBLE_KEY) === 'true'
  })

  const panelRef = useRef<HTMLDivElement>(null)
  const isDragging = useRef(false)
  const dragStartY = useRef(0)
  const dragStartHeight = useRef(0)

  // Persist panel state
  useEffect(() => {
    localStorage.setItem(PANEL_HEIGHT_KEY, String(panelHeight))
  }, [panelHeight])

  useEffect(() => {
    localStorage.setItem(PANEL_VISIBLE_KEY, String(isVisible))
  }, [isVisible])

  // Drag resize
  const handleDragStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    isDragging.current = true
    dragStartY.current = e.clientY
    dragStartHeight.current = panelHeight

    const handleDragMove = (e: MouseEvent) => {
      if (!isDragging.current) return
      const diff = dragStartY.current - e.clientY
      const maxH = window.innerHeight * MAX_HEIGHT_RATIO
      const newHeight = Math.min(maxH, Math.max(MIN_HEIGHT, dragStartHeight.current + diff))
      setPanelHeight(newHeight)
    }

    const handleDragEnd = () => {
      isDragging.current = false
      document.removeEventListener('mousemove', handleDragMove)
      document.removeEventListener('mouseup', handleDragEnd)
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }

    document.body.style.cursor = 'ns-resize'
    document.body.style.userSelect = 'none'
    document.addEventListener('mousemove', handleDragMove)
    document.addEventListener('mouseup', handleDragEnd)
  }, [panelHeight])

  const handleNewTab = useCallback(async (type = 'shell') => {
    if (!status?.available) {
      toast.error('Integrated terminal not available')
      return
    }

    try {
      const session = await createSession.mutateAsync({ projectId, type, cols: 80, rows: 24 })
      const tab: LocalTab = {
        sessionId: session.id,
        title: session.title,
        type: session.type,
        exited: false,
      }
      setTabs(prev => [...prev, tab])
      setActiveTabId(session.id)
      if (!isVisible) setIsVisible(true)
    } catch (err: any) {
      toast.error(err.message || 'Failed to create terminal')
    }
  }, [projectId, status, createSession, isVisible])

  const togglePanel = useCallback(() => {
    if (!isVisible && tabs.length === 0) {
      // Open and create a shell tab
      setIsVisible(true)
      handleNewTab('shell')
    } else {
      setIsVisible(prev => !prev)
    }
  }, [isVisible, tabs.length, handleNewTab])

  // Keyboard shortcut: Ctrl+` to toggle terminal
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.key === '`') {
        e.preventDefault()
        togglePanel()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [togglePanel])

  const handleCloseTab = useCallback((sessionId: string) => {
    killSession.mutate(sessionId)
    setTabs(prev => {
      const next = prev.filter(t => t.sessionId !== sessionId)
      if (activeTabId === sessionId) {
        setActiveTabId(next.length > 0 ? next[next.length - 1].sessionId : null)
      }
      if (next.length === 0) setIsVisible(false)
      return next
    })
  }, [activeTabId, killSession])

  const handleCloseAll = useCallback(() => {
    for (const tab of tabs) {
      killSession.mutate(tab.sessionId)
    }
    setTabs([])
    setActiveTabId(null)
    setIsVisible(false)
  }, [tabs, killSession])

  const handleTabExit = useCallback((sessionId: string, code: number) => {
    setTabs(prev => prev.map(t =>
      t.sessionId === sessionId ? { ...t, exited: true, title: `${t.title} [exited]` } : t
    ))
  }, [])

  const handleOpenExternal = useCallback(() => {
    launchNative.mutate(
      { projectId, type: 'shell' },
      { onSuccess: () => toast.success('Opened in native terminal') }
    )
  }, [projectId, launchNative])

  // Expose createTab for TerminalLauncher
  useEffect(() => {
    const handler = (e: CustomEvent<{ projectId: string; type: string }>) => {
      if (e.detail.projectId === projectId) {
        handleNewTab(e.detail.type)
      }
    }
    window.addEventListener('devdash:open-terminal' as any, handler as any)
    return () => window.removeEventListener('devdash:open-terminal' as any, handler as any)
  }, [projectId, handleNewTab])

  // Don't render if terminal not available
  if (!status?.available) return null

  return (
    <div ref={panelRef} className="relative shrink-0 border-t bg-[#0a0a0f]">
      {/* Drag handle */}
      {isVisible && (
        <div
          className="absolute top-0 left-0 right-0 h-1 cursor-ns-resize z-10 hover:bg-primary/30 transition-colors"
          onMouseDown={handleDragStart}
        />
      )}

      {/* Tab bar — always visible when there are tabs or panel is open */}
      <div className="flex items-center gap-0.5 px-2 h-8 bg-card/80 border-b border-border/50 select-none">
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              onClick={togglePanel}
              className="flex items-center gap-1.5 px-2 py-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              <Terminal className="h-3.5 w-3.5" />
              <span className="font-medium">Terminal</span>
              {tabs.length > 0 && (
                <span className="text-[10px] text-muted-foreground/60">({tabs.length})</span>
              )}
              {isVisible ? <ChevronDown className="h-3 w-3" /> : <ChevronUp className="h-3 w-3" />}
            </button>
          </TooltipTrigger>
          <TooltipContent side="top">Toggle terminal (Ctrl+`)</TooltipContent>
        </Tooltip>

        {/* Session tabs */}
        {isVisible && (
          <div className="flex items-center gap-0.5 flex-1 overflow-x-auto ml-1">
            {tabs.map(tab => (
              <button
                key={tab.sessionId}
                onClick={() => setActiveTabId(tab.sessionId)}
                className={cn(
                  'flex items-center gap-1 px-2 py-0.5 text-[11px] rounded-sm transition-colors max-w-[140px] group',
                  activeTabId === tab.sessionId
                    ? 'bg-background/60 text-foreground'
                    : 'text-muted-foreground hover:text-foreground hover:bg-background/30',
                  tab.exited && 'opacity-50'
                )}
              >
                <span className="truncate">{tab.title.replace(/^\[.*?\]\s*/, '')}</span>
                <X
                  className="h-3 w-3 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity hover:text-destructive"
                  onClick={(e) => { e.stopPropagation(); handleCloseTab(tab.sessionId) }}
                />
              </button>
            ))}

            {/* New tab button */}
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={() => handleNewTab('shell')}
                  className="p-0.5 text-muted-foreground hover:text-foreground transition-colors rounded-sm hover:bg-background/30"
                >
                  <Plus className="h-3.5 w-3.5" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="top">New terminal</TooltipContent>
            </Tooltip>
          </div>
        )}

        {/* Right actions */}
        {isVisible && tabs.length > 0 && (
          <div className="flex items-center gap-0.5 ml-auto shrink-0">
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={handleOpenExternal}
                  className="p-1 text-muted-foreground hover:text-foreground transition-colors rounded-sm hover:bg-background/30"
                >
                  <ExternalLink className="h-3 w-3" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="top">Open in native terminal</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={handleCloseAll}
                  className="p-1 text-muted-foreground hover:text-destructive transition-colors rounded-sm hover:bg-background/30"
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="top">Kill all terminals</TooltipContent>
            </Tooltip>
          </div>
        )}
      </div>

      {/* Terminal content area */}
      {isVisible && (
        <div style={{ height: panelHeight }}>
          {tabs.map(tab => (
            <div
              key={tab.sessionId}
              className={cn('h-full', activeTabId === tab.sessionId ? 'block' : 'hidden')}
            >
              <IntegratedTerminal
                sessionId={tab.sessionId}
                isActive={activeTabId === tab.sessionId}
                onExit={(code) => handleTabExit(tab.sessionId, code)}
              />
            </div>
          ))}
          {tabs.length === 0 && (
            <div className="h-full flex items-center justify-center text-muted-foreground text-sm">
              <button
                onClick={() => handleNewTab('shell')}
                className="flex items-center gap-2 px-4 py-2 rounded-md hover:bg-background/30 transition-colors"
              >
                <Plus className="h-4 w-4" />
                Open a terminal
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
