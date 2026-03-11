import { useState, useRef, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { TaskBoard } from '@/components/tasks/TaskBoard'
import { GitPanel } from '@/components/git/GitPanel'
import { TerminalLauncher } from '@/components/terminals/TerminalLauncher'
import { ChatPanel } from '@/components/claude/ChatPanel'
import { useProjects, useUpdateProject } from '@/hooks/useProjects'
import { ExternalLinkEditor } from '@/components/projects/ExternalLinkEditor'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { GitBranch, Star, ExternalLink, Pencil, Check, X } from 'lucide-react'
import { FileExplorer } from '@/components/files/FileExplorer'
import { cn } from '@/lib/utils'

export function Workspace() {
  const { projectId } = useParams<{ projectId: string }>()
  const { data: projects } = useProjects()
  const updateProject = useUpdateProject()
  const project = projects?.find(p => p.id === projectId)

  const [isRenaming, setIsRenaming] = useState(false)
  const [renameValue, setRenameValue] = useState('')
  const renameInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (isRenaming && renameInputRef.current) {
      renameInputRef.current.focus()
      renameInputRef.current.select()
    }
  }, [isRenaming])

  const startRename = () => {
    if (!project) return
    setRenameValue(project.name)
    setIsRenaming(true)
  }

  const confirmRename = () => {
    if (!project || !renameValue.trim()) return
    updateProject.mutate({ id: project.id, name: renameValue.trim() })
    setIsRenaming(false)
  }

  const cancelRename = () => {
    setIsRenaming(false)
  }

  if (!project) {
    return (
      <div className="flex-1 flex items-center justify-center text-muted-foreground">
        Project not found. Try refreshing projects.
      </div>
    )
  }

  return (
    <div className="flex-1 overflow-hidden flex flex-col">
      <div className="flex-1 overflow-hidden flex min-h-0">
        {/* Tasks - main area */}
        <div className="flex-1 overflow-y-auto p-6 min-w-0 scrollbar-dark">
          {/* Compact project info bar */}
          <div className="flex items-center gap-3 mb-4">
            <button
              onClick={() => updateProject.mutate({ id: project.id, favorite: !project.favorite })}
              className="shrink-0"
            >
              <Star className={cn(
                'h-4 w-4 transition-colors',
                project.favorite
                  ? 'fill-yellow-500 text-yellow-500'
                  : 'text-muted-foreground/30 hover:text-yellow-500'
              )} />
            </button>
            {isRenaming ? (
              <div className="flex items-center gap-1 shrink-0">
                <Input
                  ref={renameInputRef}
                  value={renameValue}
                  onChange={e => setRenameValue(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') confirmRename()
                    if (e.key === 'Escape') cancelRename()
                  }}
                  className="h-6 text-xs w-40"
                />
                <button onClick={confirmRename} className="text-green-500 hover:text-green-400 p-0.5">
                  <Check className="h-3.5 w-3.5" />
                </button>
                <button onClick={cancelRename} className="text-muted-foreground hover:text-foreground p-0.5">
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            ) : (
              <button
                onClick={startRename}
                className="flex items-center gap-1 text-xs font-medium text-foreground hover:text-primary transition-colors shrink-0 group"
                title="Click to rename project"
              >
                {project.name}
                <Pencil className="h-3 w-3 text-muted-foreground/0 group-hover:text-muted-foreground transition-colors" />
              </button>
            )}
            <span className="text-muted-foreground/30">·</span>
            <p className="text-xs text-muted-foreground truncate">{project.path}</p>
            {project.isGitRepo && project.gitBranch && (
              <Badge variant="outline" className="text-[10px] shrink-0 gap-1">
                <GitBranch className="h-2.5 w-2.5" />
                {project.gitBranch}
                {project.gitDirty && ' *'}
              </Badge>
            )}
            {project.gitRemoteUrl && (
              <a
                href={project.gitRemoteUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="shrink-0 text-muted-foreground/40 hover:text-foreground transition-colors"
                title="Open repository"
              >
                <ExternalLink className="h-3.5 w-3.5" />
              </a>
            )}
            <ExternalLinkEditor project={project} />
          </div>
          <TaskBoard projectId={project.id} projectName={project.name} projectPath={project.path} />
        </div>

        {/* Sidebar - 1/4 width */}
        <div className="w-72 xl:w-80 border-l overflow-y-auto p-4 space-y-6 shrink-0 bg-card/50 scrollbar-dark">
          <TerminalLauncher projectId={project.id} projectPath={project.path} projectName={project.name} />
          <ChatPanel projectId={project.id} />
          <FileExplorer projectId={project.id} projectPath={project.path} />
          {project.isGitRepo && (
            <GitPanel projectId={project.id} />
          )}
        </div>
      </div>

    </div>
  )
}
