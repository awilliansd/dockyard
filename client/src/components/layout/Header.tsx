import { useNavigate } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import type { Project } from '@/hooks/useProjects'

interface HeaderProps {
  project?: Project
  title?: string
}

export function Header({ project, title }: HeaderProps) {
  const navigate = useNavigate()

  return (
    <header className="h-14 border-b bg-card flex items-center px-4 gap-3 shrink-0">
      {project && (
        <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => navigate('/')}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
      )}
      <div className="flex-1 min-w-0">
        <h1 className="text-sm font-semibold truncate">{project?.name || title || 'Dockyard'}</h1>
        {project && (
          <p className="text-xs text-muted-foreground truncate">{project.path}</p>
        )}
      </div>
      {project?.isGitRepo && project.gitBranch && (
        <Badge variant="outline" className="text-[10px] shrink-0">
          {project.gitBranch}
          {project.gitDirty && ' *'}
        </Badge>
      )}
    </header>
  )
}
