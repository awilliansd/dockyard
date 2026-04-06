import type { SyncProvider, ProviderConfig } from '../types'
import type { Task } from '@/hooks/useTasks'

export const jsonExportProvider: SyncProvider = {
  definition: {
    id: 'json-export',
    name: 'JSON Backup',
    description: 'Export tasks as JSON for backup, sharing between machines, or version control',
    icon: 'FileJson',
    direction: 'export-only',
    requiresServer: false,
    phase: 1,
    available: true,
    configFields: [
      {
        key: 'includeCompleted',
        label: 'Include completed tasks',
        type: 'checkbox',
        required: false,
      },
      {
        key: 'prettyPrint',
        label: 'Pretty-print JSON (readable)',
        type: 'checkbox',
        required: false,
      },
    ],
  },

  async export(config: ProviderConfig, tasks: Task[]) {
    const includeCompleted = config.settings.includeCompleted !== false
    const prettyPrint = config.settings.prettyPrint !== false

    const filtered = includeCompleted ? tasks : tasks.filter(t => t.status !== 'done')

    const exportData = {
      exportedAt: new Date().toISOString(),
      source: 'dockyard',
      version: 1,
      projectId: config.projectId,
      taskCount: filtered.length,
      tasks: filtered.map(t => ({
        id: t.id,
        title: t.title,
        description: t.description,
        priority: t.priority,
        status: t.status,
        prompt: t.prompt || '',
        createdAt: t.createdAt,
        updatedAt: t.updatedAt,
        order: t.order,
        inboxAt: t.inboxAt,
        inProgressAt: t.inProgressAt,
        doneAt: t.doneAt,
      })),
    }

    const json = prettyPrint
      ? JSON.stringify(exportData, null, 2)
      : JSON.stringify(exportData)

    const date = new Date().toISOString().slice(0, 10)
    return {
      data: json,
      filename: `tasks-${config.projectId}-${date}.json`,
      mimeType: 'application/json',
    }
  },
}
