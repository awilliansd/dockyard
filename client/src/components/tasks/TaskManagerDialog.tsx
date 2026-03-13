import { useState } from 'react'
import { Loader2, Wand2, Check, Plus, Pencil, SkipForward, Trash2, ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { useClaudeStatus } from '@/hooks/useClaude'
import { useCreateTask, useUpdateTask, type Task } from '@/hooks/useTasks'
import { api } from '@/lib/api'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'

interface TaskAction {
  type: 'create' | 'update' | 'skip'
  task?: { title: string; description: string; prompt: string; priority: string; status: string }
  taskId?: string
  changes?: Record<string, any>
  reason?: string
  title?: string
  existingTaskId?: string
  selected: boolean
}

interface TaskManagerDialogProps {
  projectId: string
  tasks: Task[]
  open: boolean
  onOpenChange: (open: boolean) => void
}

const priorityColors: Record<string, string> = {
  urgent: 'bg-red-500/15 text-red-400',
  high: 'bg-orange-500/15 text-orange-400',
  medium: 'bg-blue-500/15 text-blue-400',
  low: 'bg-muted text-muted-foreground',
}

const actionIcons: Record<string, typeof Plus> = {
  create: Plus,
  update: Pencil,
  skip: SkipForward,
}

const actionColors: Record<string, string> = {
  create: 'text-green-400',
  update: 'text-blue-400',
  skip: 'text-muted-foreground',
}

const actionLabels: Record<string, string> = {
  create: 'Create',
  update: 'Update',
  skip: 'Skip',
}

export function TaskManagerDialog({ projectId, tasks, open, onOpenChange }: TaskManagerDialogProps) {
  const { data: claudeStatus } = useClaudeStatus()
  const createTask = useCreateTask()
  const updateTask = useUpdateTask()
  const [rawText, setRawText] = useState('')
  const [actions, setActions] = useState<TaskAction[]>([])
  const [summary, setSummary] = useState('')
  const [state, setState] = useState<'idle' | 'analyzing' | 'preview' | 'applying'>('idle')

  const aiAvailable = claudeStatus?.configured || claudeStatus?.cliAvailable

  const handleAnalyze = async () => {
    if (!rawText.trim()) return
    setState('analyzing')
    try {
      const existingTasks = (tasks || []).map(t => ({
        id: t.id,
        title: t.title,
        description: t.description,
        status: t.status,
        priority: t.priority,
      }))
      const result = await api.manageTasks(projectId, rawText, existingTasks)
      if (result.actions.length === 0) {
        toast.error('No actions identified from the text')
        setState('idle')
        return
      }
      setActions(result.actions.map(a => ({ ...a, type: a.type as TaskAction['type'], selected: a.type !== 'skip' })))
      setSummary(result.summary)
      setState('preview')
    } catch (err: any) {
      toast.error(err.message || 'Analysis failed')
      setState('idle')
    }
  }

  const handleApply = async () => {
    const selected = actions.filter(a => a.selected && a.type !== 'skip')
    if (selected.length === 0) { toast.info('No actions selected'); return }
    setState('applying')

    let created = 0
    let updated = 0

    for (const action of selected) {
      try {
        if (action.type === 'create' && action.task) {
          await createTask.mutateAsync({
            projectId,
            title: action.task.title,
            description: action.task.description,
            priority: action.task.priority as any,
            status: action.task.status as any,
            prompt: action.task.prompt,
          })
          created++
        } else if (action.type === 'update' && action.taskId && action.changes) {
          await updateTask.mutateAsync({
            projectId,
            taskId: action.taskId,
            ...action.changes,
          })
          updated++
        }
      } catch (err: any) {
        console.error(`Failed to apply action:`, err)
      }
    }

    const parts = []
    if (created > 0) parts.push(`${created} created`)
    if (updated > 0) parts.push(`${updated} updated`)
    toast.success(`Tasks: ${parts.join(', ')}`)

    setRawText('')
    setActions([])
    setSummary('')
    setState('idle')
    onOpenChange(false)
  }

  const handleClose = (open: boolean) => {
    if (!open) {
      setRawText('')
      setActions([])
      setSummary('')
      setState('idle')
    }
    onOpenChange(open)
  }

  const toggleAction = (i: number) => {
    setActions(prev => prev.map((a, idx) => idx === i ? { ...a, selected: !a.selected } : a))
  }

  const removeAction = (i: number) => {
    setActions(prev => prev.filter((_, idx) => idx !== i))
  }

  const selectedCount = actions.filter(a => a.selected && a.type !== 'skip').length
  const createCount = actions.filter(a => a.type === 'create').length
  const updateCount = actions.filter(a => a.type === 'update').length
  const skipCount = actions.filter(a => a.type === 'skip').length

  // Find existing task title by id for display
  const getTaskTitle = (taskId: string) => {
    return tasks.find(t => t.id === taskId)?.title || taskId
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="text-sm flex items-center gap-2">
            <Wand2 className="h-4 w-4" />
            AI Task Manager
          </DialogTitle>
        </DialogHeader>

        {(state === 'idle' || state === 'analyzing') && (
          <div className="space-y-3 flex-1">
            <p className="text-xs text-muted-foreground">
              Paste any text — task lists, meeting notes, client emails, bug reports — and AI will organize them into tasks.
              It can also update existing tasks, detect duplicates, and handle instructions like "mark all X as done".
            </p>
            <Textarea
              value={rawText}
              onChange={e => setRawText(e.target.value)}
              placeholder={"Paste anything here...\n\nExamples:\n- Fix login page not loading on mobile\n- Add dark mode toggle to settings\n- Mark all auth tasks as done\n- The checkout flow needs validation on the email field (URGENT)"}
              className="min-h-[220px] text-xs font-mono resize-none"
              disabled={state === 'analyzing'}
              autoFocus
            />
            {tasks.length > 0 && (
              <p className="text-[10px] text-muted-foreground">
                AI will compare against {tasks.length} existing task{tasks.length !== 1 ? 's' : ''} to avoid duplicates
              </p>
            )}
            <div className="flex items-center gap-2">
              {aiAvailable ? (
                <Button
                  size="sm"
                  className="gap-1.5 text-xs"
                  onClick={handleAnalyze}
                  disabled={!rawText.trim() || state === 'analyzing'}
                >
                  {state === 'analyzing' ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Wand2 className="h-3.5 w-3.5" />
                  )}
                  {state === 'analyzing' ? 'Analyzing...' : 'Analyze & Organize'}
                </Button>
              ) : (
                <p className="text-xs text-muted-foreground">
                  Install Claude CLI or configure API key in Settings to use AI features
                </p>
              )}
            </div>
          </div>
        )}

        {(state === 'preview' || state === 'applying') && (
          <div className="space-y-3 flex-1 overflow-hidden flex flex-col">
            {/* Summary */}
            {summary && (
              <div className="bg-muted/50 rounded-lg p-2.5 text-xs text-muted-foreground">
                {summary}
              </div>
            )}

            {/* Stats */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
                {createCount > 0 && (
                  <span className="flex items-center gap-1">
                    <Plus className="h-3 w-3 text-green-400" />
                    {createCount} new
                  </span>
                )}
                {updateCount > 0 && (
                  <span className="flex items-center gap-1">
                    <Pencil className="h-3 w-3 text-blue-400" />
                    {updateCount} update
                  </span>
                )}
                {skipCount > 0 && (
                  <span className="flex items-center gap-1">
                    <SkipForward className="h-3 w-3" />
                    {skipCount} skip
                  </span>
                )}
              </div>
              <Button
                size="sm"
                variant="ghost"
                className="text-xs h-7 gap-1"
                onClick={() => { setActions([]); setSummary(''); setState('idle') }}
              >
                <ArrowLeft className="h-3 w-3" />
                Back
              </Button>
            </div>

            {/* Action list */}
            <div className="flex-1 overflow-y-auto space-y-2 pr-1">
              {actions.map((action, i) => {
                const Icon = actionIcons[action.type] || Plus
                return (
                  <div
                    key={i}
                    className={cn(
                      'border rounded-lg p-3 space-y-1.5 transition-opacity',
                      !action.selected && 'opacity-40'
                    )}
                  >
                    <div className="flex items-start gap-2">
                      {action.type !== 'skip' && (
                        <input
                          type="checkbox"
                          checked={action.selected}
                          onChange={() => toggleAction(i)}
                          className="mt-1 rounded border-muted-foreground/30"
                        />
                      )}
                      <Icon className={cn('h-3.5 w-3.5 mt-0.5 shrink-0', actionColors[action.type])} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className={cn('text-[9px] font-medium uppercase tracking-wider', actionColors[action.type])}>
                            {actionLabels[action.type]}
                          </span>
                          {action.type === 'create' && action.task && (
                            <span className={cn(
                              'text-[9px] px-1.5 py-0.5 rounded-full',
                              priorityColors[action.task.priority] || priorityColors.medium
                            )}>
                              {action.task.priority}
                            </span>
                          )}
                        </div>
                        {action.type === 'create' && action.task && (
                          <>
                            <p className="text-xs font-medium mt-0.5">{action.task.title}</p>
                            {action.task.description && (
                              <p className="text-[11px] text-muted-foreground line-clamp-2 mt-0.5">{action.task.description}</p>
                            )}
                          </>
                        )}
                        {action.type === 'update' && (
                          <>
                            <p className="text-xs font-medium mt-0.5">{getTaskTitle(action.taskId || '')}</p>
                            {action.changes && (
                              <p className="text-[11px] text-muted-foreground mt-0.5">
                                {Object.entries(action.changes).map(([k, v]) => `${k}: ${v}`).join(', ')}
                              </p>
                            )}
                            {action.reason && (
                              <p className="text-[10px] text-muted-foreground/60 mt-0.5 italic">{action.reason}</p>
                            )}
                          </>
                        )}
                        {action.type === 'skip' && (
                          <>
                            <p className="text-xs mt-0.5 line-through">{action.title}</p>
                            {action.reason && (
                              <p className="text-[10px] text-muted-foreground/60 mt-0.5 italic">{action.reason}</p>
                            )}
                          </>
                        )}
                      </div>
                      {action.type !== 'skip' && (
                        <button onClick={() => removeAction(i)} className="text-muted-foreground/40 hover:text-red-400 p-0.5 shrink-0">
                          <Trash2 className="h-3 w-3" />
                        </button>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Apply */}
            <div className="flex justify-end pt-2 border-t">
              <Button
                size="sm"
                className="gap-1.5 text-xs"
                onClick={handleApply}
                disabled={selectedCount === 0 || state === 'applying'}
              >
                {state === 'applying' ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Check className="h-3.5 w-3.5" />
                )}
                {state === 'applying' ? 'Applying...' : `Apply ${selectedCount} Action${selectedCount !== 1 ? 's' : ''}`}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
