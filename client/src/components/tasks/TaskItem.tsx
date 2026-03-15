import { useState, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { Pencil, Trash2, Copy, CopyPlus, Check, Circle, AlertTriangle, ArrowUp, ArrowDown, Minus, Sparkles, Wand2, Loader2 } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { cn } from '@/lib/utils'
import { useCreateTask, useUpdateTask, useDeleteTask, type Task } from '@/hooks/useTasks'
import { buildTaskPrompt } from '@/lib/promptBuilder'
import { useAiSessions } from '@/hooks/useAiSessions'
import { useClaudeStatus, useAnalyzeTask } from '@/hooks/useClaude'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { toast } from 'sonner'

interface TaskItemProps {
  task: Task
  projectName?: string
  projectPath?: string
  showProjectBadge?: boolean
  projectLink?: string
  onEdit: (task: Task) => void
  onView?: (task: Task) => void
  onAiResolve?: (task: Task) => void
  dragListeners?: Record<string, Function>
}

const priorityConfig = {
  urgent: { icon: AlertTriangle, color: 'text-red-500', label: 'Urgent' },
  high: { icon: ArrowUp, color: 'text-orange-500', label: 'High' },
  medium: { icon: Minus, color: 'text-blue-500', label: 'Medium' },
  low: { icon: ArrowDown, color: 'text-red-500', label: 'Low' },
}

const statusConfig = {
  backlog: { label: 'Backlog', variant: 'outline' as const },
  todo: { label: 'To Do', variant: 'secondary' as const },
  in_progress: { label: 'In Progress', variant: 'default' as const },
  done: { label: 'Done', variant: 'outline' as const },
}

export function TaskItem({ task, projectName, projectPath, showProjectBadge, projectLink, onEdit, onView, onAiResolve, dragListeners }: TaskItemProps) {
  const createTask = useCreateTask()
  const updateTask = useUpdateTask()
  const deleteTask = useDeleteTask()
  const { hasSession: hasAiSession } = useAiSessions()
  const { data: claudeStatus } = useClaudeStatus()
  const analyzeTask = useAnalyzeTask()
  const { data: settings } = useQuery({ queryKey: ['settings'], queryFn: api.getSettings, staleTime: Infinity })
  const isAiResolving = hasAiSession(task.id)
  const canAiImprove = !!(claudeStatus?.configured || claudeStatus?.cliAvailable)

  const priority = priorityConfig[task.priority] || priorityConfig.medium
  const status = statusConfig[task.status] || statusConfig.todo
  const PriorityIcon = priority.icon

  const handleStatusToggle = (e: React.MouseEvent) => {
    e.stopPropagation()
    const nextStatus = task.status === 'done' ? 'todo' :
                       task.status === 'todo' ? 'in_progress' :
                       task.status === 'in_progress' ? 'done' : 'todo'
    updateTask.mutate({
      projectId: task.projectId,
      taskId: task.id,
      status: nextStatus,
    })
  }

  const handleCopyPrompt = (e: React.MouseEvent) => {
    e.stopPropagation()
    const prompt = buildTaskPrompt(task, projectName, projectPath, settings?.tasksDir)
    navigator.clipboard.writeText(prompt)
    toast.success('Copied to clipboard')
  }

  const handleDuplicate = (e: React.MouseEvent) => {
    e.stopPropagation()
    createTask.mutate(
      {
        projectId: task.projectId,
        title: `Copy of ${task.title}`,
        description: task.description || '',
        priority: task.priority,
        status: 'todo',
        prompt: task.prompt || '',
      },
      { onSuccess: () => toast.success('Task duplicated') }
    )
  }

  const [deleteOpen, setDeleteOpen] = useState(false)

  const handleDelete = () => {
    deleteTask.mutate({ projectId: task.projectId, taskId: task.id })
  }

  const handleEdit = (e: React.MouseEvent) => {
    e.stopPropagation()
    onEdit(task)
  }

  const handleAiImprove = async (e: React.MouseEvent) => {
    e.stopPropagation()
    try {
      const result = await analyzeTask.mutateAsync({
        projectId: task.projectId,
        title: task.title,
        taskId: task.id,
      })
      updateTask.mutate({
        projectId: task.projectId,
        taskId: task.id,
        description: result.description,
        prompt: result.prompt,
      })
      toast.success('Task improved with AI')
    } catch (err: any) {
      toast.error(err.message || 'AI analysis failed')
    }
  }

  // Timestamp of when the task entered its current column
  const columnDate = useMemo(() => {
    const ts = task.status === 'done' ? task.doneAt
      : task.status === 'in_progress' ? task.inProgressAt
      : task.inboxAt || task.createdAt
    if (!ts) return null
    const d = new Date(ts)
    if (isNaN(d.getTime())) return null
    return d
  }, [task.status, task.doneAt, task.inProgressAt, task.inboxAt, task.createdAt])

  return (
    <div
      className={cn(
        'group rounded-lg border bg-card transition-colors hover:border-primary/30 cursor-grab active:cursor-grabbing p-2',
        task.status === 'done' && 'opacity-60',
        isAiResolving && 'ring-2 ring-purple-500/40 border-purple-500/30 animate-pulse'
      )}
      {...dragListeners}
    >
      <div className="flex items-start gap-2">
        <button onClick={handleStatusToggle} className="shrink-0 mt-0.5">
          {isAiResolving ? (
            <Sparkles className="h-3.5 w-3.5 text-purple-500 animate-pulse" />
          ) : task.status === 'done' ? (
            <Check className="h-3.5 w-3.5 text-green-500" />
          ) : (
            <Circle className="h-3.5 w-3.5 text-muted-foreground" />
          )}
        </button>

        <PriorityIcon className={cn('h-3 w-3 shrink-0 mt-1', priority.color)} />

        <div className="min-w-0 flex-1">
          <span
            className={cn('text-sm line-clamp-2 cursor-pointer hover:text-primary transition-colors', task.status === 'done' && 'line-through')}
            onClick={(e) => { e.stopPropagation(); onView?.(task) }}
          >
            {task.title}
          </span>
          {showProjectBadge && projectName && (
            projectLink ? (
              <Link to={projectLink} onClick={(e) => e.stopPropagation()} className="inline-block mt-0.5">
                <Badge variant="outline" className="text-[10px] px-1.5 py-0 hover:bg-accent">
                  {projectName}
                </Badge>
              </Link>
            ) : (
              <Badge variant="outline" className="text-[10px] px-1.5 py-0 mt-0.5">
                {projectName}
              </Badge>
            )
          )}
          {task.subtasks && task.subtasks.length > 0 && (
            <span className="text-[10px] text-muted-foreground ml-1">
              {task.subtasks.filter(s => s.done).length}/{task.subtasks.length}
            </span>
          )}
        </div>

        <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0 ml-auto">
          {onAiResolve && task.status === 'in_progress' && !isAiResolving && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" className="h-6 w-6 text-purple-500 hover:text-purple-400" onClick={(e) => { e.stopPropagation(); onAiResolve(task) }}>
                  <Sparkles className="h-3 w-3" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Resolve with AI — opens Claude Code to work on this task</TooltipContent>
            </Tooltip>
          )}
          {canAiImprove && task.status !== 'done' && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 text-blue-500 hover:text-blue-400"
                  onClick={handleAiImprove}
                  disabled={analyzeTask.isPending}
                >
                  {analyzeTask.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Wand2 className="h-3 w-3" />}
                </Button>
              </TooltipTrigger>
              <TooltipContent>AI Improve — generate description and details</TooltipContent>
            </Tooltip>
          )}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" className="h-6 w-6" onClick={handleCopyPrompt}>
                <Copy className="h-3 w-3" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Copy task as prompt — paste into Claude or any AI assistant</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" className="h-6 w-6" onClick={handleDuplicate}>
                <CopyPlus className="h-3 w-3" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Duplicate task</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" className="h-6 w-6" onClick={handleEdit}>
                <Pencil className="h-3 w-3" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Edit task</TooltipContent>
          </Tooltip>
          <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
            <Tooltip>
              <TooltipTrigger asChild>
                <AlertDialogTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive" onClick={(e) => e.stopPropagation()}>
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </AlertDialogTrigger>
              </TooltipTrigger>
              <TooltipContent>Delete task</TooltipContent>
            </Tooltip>
            <AlertDialogContent onClick={(e) => e.stopPropagation()}>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete task?</AlertDialogTitle>
                <AlertDialogDescription>
                  "{task.title}" will be permanently deleted. This action cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                  Delete
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>

      {columnDate && (
        <div className="text-[10px] text-muted-foreground/40 mt-1 text-right">
          {formatDistanceToNow(columnDate, { addSuffix: true })}
        </div>
      )}
    </div>
  )
}
