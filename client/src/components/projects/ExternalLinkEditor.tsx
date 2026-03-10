import { useState } from 'react'
import { Link2, Pencil, ExternalLink, X } from 'lucide-react'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { useUpdateProject, type Project } from '@/hooks/useProjects'
import { toast } from 'sonner'

interface ExternalLinkEditorProps {
  project: Project
}

export function ExternalLinkEditor({ project }: ExternalLinkEditorProps) {
  const updateProject = useUpdateProject()
  const [open, setOpen] = useState(false)
  const [url, setUrl] = useState(project.externalLink || '')

  const handleOpen = (isOpen: boolean) => {
    setOpen(isOpen)
    if (isOpen) setUrl(project.externalLink || '')
  }

  const handleSave = () => {
    const trimmed = url.trim()
    updateProject.mutate(
      { id: project.id, externalLink: trimmed || undefined },
      {
        onSuccess: () => {
          toast.success(trimmed ? 'Link saved' : 'Link removed')
          setOpen(false)
        },
      }
    )
  }

  const handleRemove = () => {
    updateProject.mutate(
      { id: project.id, externalLink: undefined },
      {
        onSuccess: () => {
          toast.success('Link removed')
          setUrl('')
          setOpen(false)
        },
      }
    )
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleSave()
  }

  if (project.externalLink) {
    return (
      <div className="flex items-center gap-1 shrink-0">
        <Tooltip>
          <TooltipTrigger asChild>
            <a
              href={project.externalLink}
              target="_blank"
              rel="noopener noreferrer"
              className="text-muted-foreground/60 hover:text-foreground transition-colors"
            >
              <Link2 className="h-3.5 w-3.5" />
            </a>
          </TooltipTrigger>
          <TooltipContent>{project.externalLink}</TooltipContent>
        </Tooltip>
        <Popover open={open} onOpenChange={handleOpen}>
          <PopoverTrigger asChild>
            <button className="text-muted-foreground/30 hover:text-foreground transition-colors">
              <Pencil className="h-2.5 w-2.5" />
            </button>
          </PopoverTrigger>
          <PopoverContent className="w-80" align="start">
            <div className="space-y-3">
              <p className="text-xs font-medium text-muted-foreground">External Link</p>
              <Input
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="https://..."
                className="h-8 text-sm"
                autoFocus
              />
              <div className="flex items-center justify-between">
                <Button variant="ghost" size="sm" className="h-7 text-xs text-destructive hover:text-destructive" onClick={handleRemove}>
                  <X className="h-3 w-3 mr-1" />
                  Remove
                </Button>
                <Button size="sm" className="h-7 text-xs" onClick={handleSave}>
                  Save
                </Button>
              </div>
            </div>
          </PopoverContent>
        </Popover>
      </div>
    )
  }

  return (
    <Popover open={open} onOpenChange={handleOpen}>
      <Tooltip>
        <TooltipTrigger asChild>
          <PopoverTrigger asChild>
            <button className="shrink-0 text-muted-foreground/30 hover:text-foreground transition-colors">
              <Link2 className="h-3.5 w-3.5" />
            </button>
          </PopoverTrigger>
        </TooltipTrigger>
        <TooltipContent>Add external link (docs, task tracker, etc.)</TooltipContent>
      </Tooltip>
      <PopoverContent className="w-80" align="start">
        <div className="space-y-3">
          <p className="text-xs font-medium text-muted-foreground">External Link</p>
          <Input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="https://docs.google.com/..."
            className="h-8 text-sm"
            autoFocus
          />
          <div className="flex justify-end">
            <Button size="sm" className="h-7 text-xs" onClick={handleSave} disabled={!url.trim()}>
              Save
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  )
}
