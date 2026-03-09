import type { Task } from '@/hooks/useTasks'

const priorityLabel = { urgent: 'URGENT', high: 'HIGH', medium: 'MEDIUM', low: 'LOW' }

export function buildTaskPrompt(
  task: Task,
  projectName: string | undefined,
  projectPath: string | undefined,
  tasksDir: string | undefined,
): string {
  if (task.promptTemplate) return task.promptTemplate

  const sep = tasksDir?.includes('\\') ? '\\' : '/'
  const tasksFilePath = tasksDir ? `${tasksDir}${sep}${task.projectId}.json` : null

  const lines: string[] = []

  // Task instruction
  lines.push(`# Task: ${task.title}`)
  lines.push('')
  if (task.description) {
    lines.push(task.description)
    lines.push('')
  }
  lines.push(`Priority: ${priorityLabel[task.priority]}`)
  if (projectName) lines.push(`Project: ${projectName}`)
  if (projectPath) lines.push(`Project path: ${projectPath}`)
  lines.push('')

  // AI instructions
  lines.push('## Instructions')
  lines.push('1. Investigate the codebase to understand the context of this task')
  lines.push('2. Plan and implement the solution')
  lines.push('3. Test that your changes work correctly')

  // DevDash task update instructions
  if (tasksFilePath) {
    lines.push(`4. After completing the task, update the DevDash tasks file to mark this task as done:`)
    lines.push(`   - File: ${tasksFilePath}`)
    lines.push(`   - Find the task with id "${task.id}" and set:`)
    lines.push(`     - "status": "done"`)
    lines.push(`     - "doneAt": "<current ISO timestamp>"`)
    lines.push(`     - "updatedAt": "<current ISO timestamp>"`)
  }

  return lines.join('\n')
}
