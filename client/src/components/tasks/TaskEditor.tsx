import { useState, useEffect, useRef } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useCreateTask, useUpdateTask, type Task } from '@/hooks/useTasks'
import { TaskAnalysisButton } from '@/components/claude/TaskAnalysisButton'
import { toast } from 'sonner'

interface TaskEditorProps {
  projectId: string
  task?: Task | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function TaskEditor({ projectId, task, open, onOpenChange }: TaskEditorProps) {
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [priority, setPriority] = useState<string>('medium')
  const [status, setStatus] = useState<string>('todo')
  const [prompt, setPrompt] = useState('')
  const [quickCreate, setQuickCreate] = useState(() =>
    localStorage.getItem('shipyard:quick-create') === 'true'
  )
  const titleInputRef = useRef<HTMLInputElement>(null)

  const createTask = useCreateTask()
  const updateTask = useUpdateTask()

  useEffect(() => {
    if (task) {
      setTitle(task.title)
      setDescription(task.description)
      setPriority(task.priority)
      setStatus(task.status)
      setPrompt(task.prompt || '')
    } else {
      setTitle('')
      setDescription('')
      setPriority('medium')
      setStatus('todo')
      setPrompt('')
    }
  }, [task, open])

  const resetForm = () => {
    setTitle('')
    setDescription('')
    setPriority('medium')
    setStatus('todo')
    setPrompt('')
    setTimeout(() => titleInputRef.current?.focus(), 50)
  }

  const handleSave = () => {
    if (!title.trim()) return

    if (task) {
      updateTask.mutate(
        { projectId, taskId: task.id, title, description, priority, status, prompt: prompt || undefined },
        { onSuccess: () => onOpenChange(false) }
      )
    } else {
      createTask.mutate(
        { projectId, title, description, priority, status, prompt: prompt || undefined },
        {
          onSuccess: () => {
            if (quickCreate) {
              toast.success(`Task created: ${title}`)
              resetForm()
            } else {
              onOpenChange(false)
            }
          },
        }
      )
    }
  }

  const handleTitleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey && title.trim()) {
      e.preventDefault()
      handleSave()
    }
  }

  const toggleQuickCreate = () => {
    const next = !quickCreate
    setQuickCreate(next)
    localStorage.setItem('shipyard:quick-create', String(next))
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>{task ? 'Edit Task' : 'New Task'}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div>
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium">Title</label>
              <TaskAnalysisButton
                projectId={projectId}
                taskId={task?.id}
                title={title}
                onResult={({ description: d, prompt: p }) => {
                  if (d) setDescription(d)
                  if (p) setPrompt(p)
                }}
              />
            </div>
            <Input
              ref={titleInputRef}
              value={title}
              onChange={e => setTitle(e.target.value)}
              onKeyDown={handleTitleKeyDown}
              placeholder="Task title..."
              className="mt-1"
              autoFocus
            />
          </div>
          <div>
            <label className="text-sm font-medium">Description</label>
            <Textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Optional description..."
              className="mt-1"
              rows={6}
            />
          </div>
          <div className="flex gap-4">
            <div className="flex-1">
              <label className="text-sm font-medium">Priority</label>
              <Select value={priority} onValueChange={setPriority}>
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="urgent">Urgent</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="low">Low</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex-1">
              <label className="text-sm font-medium">Status</label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="backlog">Backlog</SelectItem>
                  <SelectItem value="todo">To Do</SelectItem>
                  <SelectItem value="in_progress">In Progress</SelectItem>
                  <SelectItem value="done">Done</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <label className="text-sm font-medium">Details</label>
            <Textarea
              value={prompt}
              onChange={e => setPrompt(e.target.value)}
              placeholder="Technical details, causes, solutions, relevant files..."
              className="mt-1 font-mono text-xs"
              rows={4}
            />
          </div>
        </div>
        <DialogFooter className="flex items-center justify-between sm:justify-between">
          {!task && (
            <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer select-none">
              <input
                type="checkbox"
                checked={quickCreate}
                onChange={toggleQuickCreate}
                className="rounded border-border"
              />
              Quick create
            </label>
          )}
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={!title.trim()}>
              {task ? 'Save' : 'Create'}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
