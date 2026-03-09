import { useParams } from 'react-router-dom'
import { TaskBoard } from '@/components/tasks/TaskBoard'
import { GitPanel } from '@/components/git/GitPanel'
import { TerminalLauncher } from '@/components/terminals/TerminalLauncher'
import { useProjects } from '@/hooks/useProjects'
import { Badge } from '@/components/ui/badge'
import { GitBranch } from 'lucide-react'

export function Workspace() {
  const { projectId } = useParams<{ projectId: string }>()
  const { data: projects } = useProjects()
  const project = projects?.find(p => p.id === projectId)

  if (!project) {
    return (
      <div className="flex-1 flex items-center justify-center text-muted-foreground">
        Project not found. Try refreshing projects.
      </div>
    )
  }

  return (
    <div className="flex-1 overflow-hidden flex">
      {/* Tasks - main area */}
      <div className="flex-1 overflow-y-auto p-6 min-w-0 scrollbar-dark">
        {/* Compact project info bar */}
        <div className="flex items-center gap-3 mb-4">
          <p className="text-xs text-muted-foreground truncate">{project.path}</p>
          {project.isGitRepo && project.gitBranch && (
            <Badge variant="outline" className="text-[10px] shrink-0 gap-1">
              <GitBranch className="h-2.5 w-2.5" />
              {project.gitBranch}
              {project.gitDirty && ' *'}
            </Badge>
          )}
        </div>
        <TaskBoard projectId={project.id} projectName={project.name} projectPath={project.path} />
      </div>

      {/* Sidebar - 1/4 width */}
      <div className="w-72 xl:w-80 border-l overflow-y-auto p-4 space-y-6 shrink-0 bg-card/50 scrollbar-dark">
        <TerminalLauncher projectId={project.id} projectPath={project.path} projectName={project.name} />
        {project.isGitRepo && (
          <GitPanel projectId={project.id} />
        )}
      </div>
    </div>
  )
}
