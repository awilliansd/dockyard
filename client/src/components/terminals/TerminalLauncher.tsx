import { useState } from 'react'
import { Terminal, Play, Monitor, FolderOpen, Copy, Sparkles, ExternalLink } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { useLaunchTerminal, useOpenFolder } from '@/hooks/useProjects'
import { useTerminalStatus } from '@/hooks/useTerminal'
import { useTasks, type Task } from '@/hooks/useTasks'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'

interface TerminalLauncherProps {
  projectId: string
  projectPath?: string
  projectName?: string
}

const priorityLabel = { urgent: 'URGENT', high: 'HIGH', medium: 'MEDIUM', low: 'LOW' }
const statusLabel = { backlog: 'BACKLOG', todo: 'TODO', in_progress: 'IN_PROGRESS', done: 'DONE' }

function buildClaudeContext(projectName: string, projectPath: string, projectId: string, tasks: Task[], tasksDir: string) {
  const sep = tasksDir.includes('\\') ? '\\' : '/'
  const tasksFile = `${tasksDir}${sep}${projectId}.json`

  const lines = [
    `Project: ${projectName}`,
    `Project path: ${projectPath}`,
    `DevDash tasks file: ${tasksFile}`,
    '',
  ]

  const active = tasks.filter(t => t.status !== 'done')
  const done = tasks.filter(t => t.status === 'done')

  if (active.length > 0) {
    lines.push(`Active tasks (${active.length}):`)
    for (const t of active) {
      lines.push(`- [${statusLabel[t.status]}] ${t.title} (${priorityLabel[t.priority]})${t.description ? ` — ${t.description}` : ''}`)
      if (t.prompt) lines.push(`  Detalhes: ${t.prompt.split('\n')[0]}${t.prompt.includes('\n') ? '...' : ''}`)
    }
  }

  if (done.length > 0) {
    lines.push('')
    lines.push(`Done (${done.length}):`)
    for (const t of done.slice(0, 5)) {
      lines.push(`- [DONE] ${t.title}`)
    }
    if (done.length > 5) lines.push(`  ... and ${done.length - 5} more`)
  }

  lines.push('')
  lines.push('You can read and update the tasks JSON file directly to organize, add, or update tasks.')
  lines.push('IMPORTANT: Each task has timestamp fields (inboxAt, inProgressAt, doneAt) tracking when it entered each stage. NEVER remove or reset these. When changing status, add the new timestamp without erasing previous ones.')

  return lines.join('\n')
}

function openIntegratedTerminal(projectId: string, type: string) {
  window.dispatchEvent(new CustomEvent('devdash:open-terminal', { detail: { projectId, type } }))
}

export function TerminalLauncher({ projectId, projectPath, projectName }: TerminalLauncherProps) {
  const launchTerminal = useLaunchTerminal()
  const openFolder = useOpenFolder()
  const { data: terminalStatus } = useTerminalStatus()
  const hasIntegrated = terminalStatus?.available ?? false
  const { data: tasks } = useTasks(projectId)
  const { data: settings } = useQuery({ queryKey: ['settings'], queryFn: api.getSettings, staleTime: Infinity })
  const [skipPermissions, setSkipPermissions] = useState(() => {
    try { return localStorage.getItem('devdash:skipPermissions') === 'true' } catch { return false }
  })

  const handleCopyContext = () => {
    if (!projectPath || !projectName) return
    const context = buildClaudeContext(projectName, projectPath, projectId, tasks || [], settings?.tasksDir || '')
    navigator.clipboard.writeText(context)
    toast.success('Context copied — paste in Claude')
  }

  const claudeType = skipPermissions ? 'claude-yolo' : 'claude'

  const handleLaunchClaudeWithContext = () => {
    // Copy context first, then launch Claude
    if (projectPath && projectName) {
      const context = buildClaudeContext(projectName, projectPath, projectId, tasks || [], settings?.tasksDir || '')
      navigator.clipboard.writeText(context)
    }
    if (hasIntegrated) {
      openIntegratedTerminal(projectId, claudeType)
      toast.success('Claude opened — context is in your clipboard, just paste')
    } else {
      launchTerminal.mutate(
        { projectId, type: claudeType },
        { onSuccess: () => toast.success('Claude opened — context is in your clipboard, just paste') }
      )
    }
  }

  return (
    <div className="space-y-5">
      {/* Claude Context */}
      {projectPath && projectName && (
        <div className="space-y-2">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Claude</h2>
          <div className="space-y-1">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="default"
                  className="w-full justify-start gap-2 h-8 text-xs"
                  onClick={handleLaunchClaudeWithContext}
                >
                  <Sparkles className="h-3.5 w-3.5" />
                  Open Claude + Copy Context
                </Button>
              </TooltipTrigger>
              <TooltipContent side="left">
                <p className="max-w-[200px] text-xs">Copies project info + tasks to clipboard, then opens Claude Code in a terminal. Just paste to give Claude your context.</p>
              </TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  className="w-full justify-start gap-2 h-8 text-xs"
                  onClick={handleCopyContext}
                >
                  <Copy className="h-3.5 w-3.5" />
                  Copy Tasks Context
                </Button>
              </TooltipTrigger>
              <TooltipContent side="left">
                <p className="max-w-[200px] text-xs">Copies project path + all tasks to clipboard. Paste into any AI assistant or text editor.</p>
              </TooltipContent>
            </Tooltip>
          </div>
          <label className="flex items-center gap-2 px-1 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={skipPermissions}
              onChange={e => {
              setSkipPermissions(e.target.checked)
              localStorage.setItem('devdash:skipPermissions', String(e.target.checked))
            }}
              className="rounded border-muted-foreground/30"
            />
            <span className="text-[10px] text-muted-foreground">Skip permissions (--dangerously-skip-permissions)</span>
          </label>
        </div>
      )}

      {/* Quick Launch */}
      <div className="space-y-2">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Quick Launch</h2>
        <div className="space-y-1">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                className="w-full justify-start gap-2 h-8 text-xs"
                onClick={() => {
                  if (hasIntegrated) {
                    openIntegratedTerminal(projectId, claudeType)
                  } else {
                    launchTerminal.mutate(
                      { projectId, type: claudeType },
                      { onSuccess: () => toast.success('Launched Claude Code') }
                    )
                  }
                }}
              >
                <Terminal className="h-3.5 w-3.5" />
                Claude Code
              </Button>
            </TooltipTrigger>
            <TooltipContent side="left">Opens Claude Code in {hasIntegrated ? 'the integrated terminal' : 'a native terminal'}</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                className="w-full justify-start gap-2 h-8 text-xs"
                onClick={() => {
                  if (hasIntegrated) {
                    openIntegratedTerminal(projectId, 'dev')
                  } else {
                    launchTerminal.mutate(
                      { projectId, type: 'dev' },
                      { onSuccess: () => toast.success('Launched Dev Server') }
                    )
                  }
                }}
              >
                <Play className="h-3.5 w-3.5" />
                Dev Server
              </Button>
            </TooltipTrigger>
            <TooltipContent side="left">Runs the dev server {hasIntegrated ? 'in the integrated terminal' : 'in a native terminal'}</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                className="w-full justify-start gap-2 h-8 text-xs"
                onClick={() => {
                  if (hasIntegrated) {
                    openIntegratedTerminal(projectId, 'shell')
                  } else {
                    launchTerminal.mutate(
                      { projectId, type: 'shell' },
                      { onSuccess: () => toast.success('Launched Shell') }
                    )
                  }
                }}
              >
                <Monitor className="h-3.5 w-3.5" />
                Shell
              </Button>
            </TooltipTrigger>
            <TooltipContent side="left">Opens a shell {hasIntegrated ? 'in the integrated terminal' : 'in a native terminal'}</TooltipContent>
          </Tooltip>
          {hasIntegrated && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  className="w-full justify-start gap-2 h-8 text-xs text-muted-foreground"
                  onClick={() => launchTerminal.mutate(
                    { projectId, type: 'shell' },
                    { onSuccess: () => toast.success('Opened native terminal') }
                  )}
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                  Open Native Terminal
                </Button>
              </TooltipTrigger>
              <TooltipContent side="left">Opens a separate native terminal window</TooltipContent>
            </Tooltip>
          )}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                className="w-full justify-start gap-2 h-8 text-xs"
                onClick={() => openFolder.mutate(projectId, {
                  onSuccess: () => toast.success('Opened folder'),
                })}
              >
                <FolderOpen className="h-3.5 w-3.5" />
                Open Folder
              </Button>
            </TooltipTrigger>
            <TooltipContent side="left">Opens the project folder in your file manager</TooltipContent>
          </Tooltip>
        </div>
      </div>
    </div>
  )
}
