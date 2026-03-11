import { readProviderConfig, writeProviderConfig } from './configStore'
import { getProvider } from './registry'
import { api } from '@/lib/api'
import type { Task } from '@/hooks/useTasks'
import type { ProviderId } from './types'
import { toast } from 'sonner'

// Import providers to ensure registration
import './providers'

let lastPushAt = 0
const PUSH_GUARD_MS = 10_000
const pushTimers = new Map<string, ReturnType<typeof setTimeout>>()

export function getLastPushAt() {
  return lastPushAt
}

export function setLastPushAt(ts: number) {
  lastPushAt = ts
}

/**
 * Schedule auto-sync for all enabled providers on a project.
 * Called from useTasks.ts mutation onSuccess callbacks.
 * Debounced by 2s per project.
 */
export function scheduleAutoSync(projectId: string) {
  clearTimeout(pushTimers.get(projectId))
  pushTimers.set(projectId, setTimeout(async () => {
    await runAutoSync(projectId)
  }, 2000))
}

async function runAutoSync(projectId: string) {
  // Google Sheets (the main bidirectional provider)
  const sheetsConfig = readProviderConfig(projectId, 'google-sheets')
  if (sheetsConfig?.enabled && sheetsConfig.settings?.url) {
    const provider = getProvider('google-sheets')
    if (provider?.merge) {
      try {
        const { tasks: localTasks } = await api.getTasks(projectId)
        const result = await provider.merge(sheetsConfig, localTasks as Task[])

        lastPushAt = Date.now()
        writeProviderConfig(projectId, 'google-sheets', {
          ...sheetsConfig,
          lastSyncAt: new Date().toISOString(),
          lastSyncStatus: 'ok',
          lastSyncError: null,
        })
      } catch (err: any) {
        writeProviderConfig(projectId, 'google-sheets', {
          ...sheetsConfig,
          lastSyncStatus: 'error',
          lastSyncError: err.message,
        })
        toast.error(`Auto-sync failed: ${err.message}`)
      }
    }
  }

  // Future: iterate other enabled providers here
}

// Re-export for backward compat
export { scheduleAutoSync as scheduleAutoSyncPush }
