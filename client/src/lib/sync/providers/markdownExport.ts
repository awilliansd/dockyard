import type { SyncProvider, ProviderConfig } from '../types'
import type { Task } from '@/hooks/useTasks'

type MarkdownFormat = 'checklist' | 'table' | 'detailed'
type GroupBy = 'status' | 'priority' | 'flat'

const STATUS_ORDER: Record<string, number> = { in_progress: 0, todo: 1, backlog: 2, done: 3 }
const PRIORITY_ORDER: Record<string, number> = { urgent: 0, high: 1, medium: 2, low: 3 }
const PRIORITY_EMOJI: Record<string, string> = { urgent: '🔴', high: '🟠', medium: '🟡', low: '🟢' }
const STATUS_LABEL: Record<string, string> = { backlog: 'Backlog', todo: 'To Do', in_progress: 'In Progress', done: 'Done' }
const PRIORITY_LABEL: Record<string, string> = { urgent: 'Urgent', high: 'High', medium: 'Medium', low: 'Low' }

function taskToChecklist(t: Task, showPriority: boolean): string {
  const check = t.status === 'done' ? 'x' : ' '
  const priority = showPriority ? ` **[${t.priority.toUpperCase()}]**` : ''
  const desc = t.description ? `\n  > ${t.description.split('\n')[0]}` : ''
  return `- [${check}]${priority} ${t.title}${desc}`
}

function taskToDetailed(t: Task): string {
  const lines = [`### ${t.status === 'done' ? '~~' + t.title + '~~' : t.title}`]
  lines.push(`- **Priority:** ${PRIORITY_EMOJI[t.priority]} ${PRIORITY_LABEL[t.priority]}`)
  lines.push(`- **Status:** ${STATUS_LABEL[t.status]}`)
  if (t.description) lines.push(`\n${t.description}`)
  if (t.prompt) lines.push(`\n<details>\n<summary>Technical details</summary>\n\n${t.prompt}\n</details>`)
  return lines.join('\n')
}

function generateChecklist(tasks: Task[], groupBy: GroupBy, projectName: string, includeDone: boolean): string {
  const lines: string[] = [`# Tasks - ${projectName}`, '']
  const filtered = includeDone ? tasks : tasks.filter(t => t.status !== 'done')

  if (groupBy === 'flat') {
    for (const t of filtered) lines.push(taskToChecklist(t, true))
  } else if (groupBy === 'status') {
    const groups = new Map<string, Task[]>()
    for (const t of filtered) {
      const g = groups.get(t.status) || []
      g.push(t)
      groups.set(t.status, g)
    }
    const sorted = [...groups.entries()].sort((a, b) => (STATUS_ORDER[a[0]] ?? 9) - (STATUS_ORDER[b[0]] ?? 9))
    for (const [status, group] of sorted) {
      lines.push(`## ${STATUS_LABEL[status] || status}`)
      for (const t of group) lines.push(taskToChecklist(t, true))
      lines.push('')
    }
  } else {
    const groups = new Map<string, Task[]>()
    for (const t of filtered) {
      const g = groups.get(t.priority) || []
      g.push(t)
      groups.set(t.priority, g)
    }
    const sorted = [...groups.entries()].sort((a, b) => (PRIORITY_ORDER[a[0]] ?? 9) - (PRIORITY_ORDER[b[0]] ?? 9))
    for (const [priority, group] of sorted) {
      lines.push(`## ${PRIORITY_EMOJI[priority]} ${PRIORITY_LABEL[priority]}`)
      for (const t of group) lines.push(taskToChecklist(t, false))
      lines.push('')
    }
  }

  lines.push('', `---`, `*Exported from DevDash on ${new Date().toISOString().slice(0, 10)}*`)
  return lines.join('\n')
}

function generateTable(tasks: Task[], projectName: string, includeDone: boolean): string {
  const filtered = includeDone ? tasks : tasks.filter(t => t.status !== 'done')
  const lines: string[] = [
    `# Tasks - ${projectName}`,
    '',
    '| Status | Priority | Title | Description |',
    '|--------|----------|-------|-------------|',
  ]

  for (const t of filtered) {
    const check = t.status === 'done' ? '~~Done~~' : STATUS_LABEL[t.status]
    const desc = (t.description || '').split('\n')[0].slice(0, 80)
    lines.push(`| ${check} | ${PRIORITY_EMOJI[t.priority]} ${t.priority} | ${t.title} | ${desc} |`)
  }

  lines.push('', `---`, `*Exported from DevDash on ${new Date().toISOString().slice(0, 10)}*`)
  return lines.join('\n')
}

function generateDetailed(tasks: Task[], projectName: string, includeDone: boolean): string {
  const filtered = includeDone ? tasks : tasks.filter(t => t.status !== 'done')
  const lines: string[] = [`# Tasks - ${projectName}`, '']

  const groups = new Map<string, Task[]>()
  for (const t of filtered) {
    const g = groups.get(t.status) || []
    g.push(t)
    groups.set(t.status, g)
  }

  const sorted = [...groups.entries()].sort((a, b) => (STATUS_ORDER[a[0]] ?? 9) - (STATUS_ORDER[b[0]] ?? 9))
  for (const [status, group] of sorted) {
    lines.push(`## ${STATUS_LABEL[status] || status} (${group.length})`, '')
    for (const t of group) {
      lines.push(taskToDetailed(t), '')
    }
  }

  lines.push(`---`, `*Exported from DevDash on ${new Date().toISOString().slice(0, 10)}*`)
  return lines.join('\n')
}

export const markdownExportProvider: SyncProvider = {
  definition: {
    id: 'markdown-export',
    name: 'Markdown Export',
    description: 'Export tasks as Markdown checklist, table, or detailed format for repos and wikis',
    icon: 'FileText',
    direction: 'export-only',
    requiresServer: false,
    phase: 1,
    available: true,
    configFields: [
      {
        key: 'format',
        label: 'Format',
        type: 'select',
        required: false,
        options: [
          { value: 'checklist', label: 'Checklist (- [ ] task)' },
          { value: 'table', label: 'Table (| col | col |)' },
          { value: 'detailed', label: 'Detailed (with descriptions)' },
        ],
      },
      {
        key: 'groupBy',
        label: 'Group by',
        type: 'select',
        required: false,
        options: [
          { value: 'status', label: 'Status (In Progress, To Do, Done)' },
          { value: 'priority', label: 'Priority (Urgent, High, Medium, Low)' },
          { value: 'flat', label: 'Flat list (no grouping)' },
        ],
      },
      {
        key: 'includeDone',
        label: 'Include completed tasks',
        type: 'checkbox',
        required: false,
      },
    ],
  },

  async export(config: ProviderConfig, tasks: Task[]) {
    const format = (config.settings.format || 'checklist') as MarkdownFormat
    const groupBy = (config.settings.groupBy || 'status') as GroupBy
    const includeDone = config.settings.includeDone ?? false
    const projectName = config.projectId

    let markdown: string
    switch (format) {
      case 'table':
        markdown = generateTable(tasks, projectName, includeDone)
        break
      case 'detailed':
        markdown = generateDetailed(tasks, projectName, includeDone)
        break
      default:
        markdown = generateChecklist(tasks, groupBy, projectName, includeDone)
    }

    const date = new Date().toISOString().slice(0, 10)
    return {
      data: markdown,
      filename: `tasks-${config.projectId}-${date}.md`,
      mimeType: 'text/markdown',
    }
  },
}
