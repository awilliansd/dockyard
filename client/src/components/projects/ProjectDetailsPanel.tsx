import { useState, useRef, useEffect } from 'react'
import { StickyNote, Link2, Plus, Trash2, ExternalLink, ChevronDown, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { useUpdateProject, type Project } from '@/hooks/useProjects'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

interface ProjectDetailsPanelProps {
  project: Project
}

export function ProjectDetailsPanel({ project }: ProjectDetailsPanelProps) {
  const updateProject = useUpdateProject()
  const [collapsed, setCollapsed] = useState(() =>
    localStorage.getItem('dockyard:details-collapsed') !== 'false'
  )

  // Notes
  const [editingNotes, setEditingNotes] = useState(false)
  const [notesValue, setNotesValue] = useState(project.notes || '')
  const notesRef = useRef<HTMLTextAreaElement>(null)

  // Links
  const [addingLink, setAddingLink] = useState(false)
  const [linkLabel, setLinkLabel] = useState('')
  const [linkUrl, setLinkUrl] = useState('')
  const linkLabelRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    setNotesValue(project.notes || '')
  }, [project.notes])

  const toggleCollapsed = () => {
    const next = !collapsed
    setCollapsed(next)
    localStorage.setItem('dockyard:details-collapsed', String(next))
  }

  const saveNotes = () => {
    const trimmed = notesValue.trim()
    updateProject.mutate(
      { id: project.id, notes: trimmed || undefined },
      { onSuccess: () => { setEditingNotes(false); toast.success('Notes saved') } }
    )
  }

  const addLink = () => {
    if (!linkLabel.trim() || !linkUrl.trim()) return
    const newLinks = [...(project.links || []), { label: linkLabel.trim(), url: linkUrl.trim() }]
    updateProject.mutate(
      { id: project.id, links: newLinks },
      {
        onSuccess: () => {
          setLinkLabel('')
          setLinkUrl('')
          setAddingLink(false)
          toast.success('Link added')
        },
      }
    )
  }

  const removeLink = (index: number) => {
    const newLinks = (project.links || []).filter((_, i) => i !== index)
    updateProject.mutate(
      { id: project.id, links: newLinks.length > 0 ? newLinks : undefined },
      { onSuccess: () => toast.success('Link removed') }
    )
  }

  const hasContent = !!(project.notes || (project.links && project.links.length > 0))

  return (
    <div>
      <button
        onClick={toggleCollapsed}
        className="flex items-center gap-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider w-full hover:text-foreground transition-colors"
      >
        {collapsed ? <ChevronRight className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
        <StickyNote className="h-3.5 w-3.5" />
        Details
        {hasContent && collapsed && (
          <span className="text-[10px] font-normal normal-case tracking-normal text-muted-foreground/60">
            ({[project.notes ? 'notes' : '', project.links?.length ? `${project.links.length} links` : ''].filter(Boolean).join(', ')})
          </span>
        )}
      </button>

      {!collapsed && (
        <div className="mt-3 space-y-3">
          {/* Notes */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <span className="text-[11px] text-muted-foreground font-medium">Notes</span>
              {!editingNotes && (
                <button
                  onClick={() => { setEditingNotes(true); setTimeout(() => notesRef.current?.focus(), 50) }}
                  className="text-[10px] text-muted-foreground/50 hover:text-foreground transition-colors"
                >
                  {project.notes ? 'edit' : '+ add'}
                </button>
              )}
            </div>
            {editingNotes ? (
              <div className="space-y-1.5">
                <Textarea
                  ref={notesRef}
                  value={notesValue}
                  onChange={e => setNotesValue(e.target.value)}
                  placeholder="Project notes, context, reminders..."
                  className="text-xs min-h-[60px] resize-none"
                  rows={3}
                  onKeyDown={e => {
                    if (e.key === 'Escape') { setEditingNotes(false); setNotesValue(project.notes || '') }
                  }}
                />
                <div className="flex justify-end gap-1">
                  <Button variant="ghost" size="sm" className="h-6 text-[10px] px-2" onClick={() => { setEditingNotes(false); setNotesValue(project.notes || '') }}>
                    Cancel
                  </Button>
                  <Button size="sm" className="h-6 text-[10px] px-2" onClick={saveNotes}>
                    Save
                  </Button>
                </div>
              </div>
            ) : project.notes ? (
              <p className="text-xs text-muted-foreground whitespace-pre-wrap break-words leading-relaxed">
                {project.notes}
              </p>
            ) : null}
          </div>

          {/* Links */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <span className="text-[11px] text-muted-foreground font-medium">Links</span>
              <button
                onClick={() => { setAddingLink(true); setTimeout(() => linkLabelRef.current?.focus(), 50) }}
                className="text-[10px] text-muted-foreground/50 hover:text-foreground transition-colors"
              >
                + add
              </button>
            </div>

            {project.links && project.links.length > 0 && (
              <div className="space-y-1">
                {project.links.map((link, i) => (
                  <div key={i} className="flex items-center gap-1.5 group">
                    <Link2 className="h-3 w-3 text-muted-foreground/50 shrink-0" />
                    <a
                      href={link.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-blue-500 hover:text-blue-400 truncate flex-1 transition-colors"
                      title={link.url}
                    >
                      {link.label}
                    </a>
                    <button
                      onClick={() => removeLink(i)}
                      className="opacity-0 group-hover:opacity-100 text-muted-foreground/40 hover:text-destructive transition-all shrink-0"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {addingLink && (
              <div className="mt-1.5 space-y-1.5 rounded border p-2 bg-muted/30">
                <Input
                  ref={linkLabelRef}
                  value={linkLabel}
                  onChange={e => setLinkLabel(e.target.value)}
                  placeholder="Label (e.g. Figma, Notion)"
                  className="h-7 text-xs"
                  onKeyDown={e => {
                    if (e.key === 'Escape') { setAddingLink(false); setLinkLabel(''); setLinkUrl('') }
                  }}
                />
                <Input
                  value={linkUrl}
                  onChange={e => setLinkUrl(e.target.value)}
                  placeholder="https://..."
                  className="h-7 text-xs"
                  onKeyDown={e => {
                    if (e.key === 'Enter' && linkLabel.trim() && linkUrl.trim()) addLink()
                    if (e.key === 'Escape') { setAddingLink(false); setLinkLabel(''); setLinkUrl('') }
                  }}
                />
                <div className="flex justify-end gap-1">
                  <Button variant="ghost" size="sm" className="h-6 text-[10px] px-2" onClick={() => { setAddingLink(false); setLinkLabel(''); setLinkUrl('') }}>
                    Cancel
                  </Button>
                  <Button size="sm" className="h-6 text-[10px] px-2" onClick={addLink} disabled={!linkLabel.trim() || !linkUrl.trim()}>
                    Add
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
