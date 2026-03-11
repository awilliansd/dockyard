import type { ProviderId, ProviderConfig } from './types'

// Key format: devdash:sync:{projectId}:{providerId}
// Legacy format (Google Sheets): devdash:sync:{projectId}
const SYNC_KEY = (projectId: string, providerId: ProviderId) =>
  `devdash:sync:${projectId}:${providerId}`

const LEGACY_SHEETS_KEY = (projectId: string) =>
  `devdash:sync:${projectId}`

// Global credentials (e.g., GitHub PAT): devdash:sync:global:{providerId}
const GLOBAL_KEY = (providerId: ProviderId) =>
  `devdash:sync:global:${providerId}`

export function readProviderConfig(projectId: string, providerId: ProviderId): ProviderConfig | null {
  try {
    // Try new format first
    const raw = localStorage.getItem(SYNC_KEY(projectId, providerId))
    if (raw) return JSON.parse(raw)

    // Legacy: Google Sheets used devdash:sync:{projectId} directly
    if (providerId === 'google-sheets') {
      const legacy = localStorage.getItem(LEGACY_SHEETS_KEY(projectId))
      if (legacy) {
        const old = JSON.parse(legacy)
        if (old.url) {
          // Migrate to new format
          const config: ProviderConfig = {
            providerId: 'google-sheets',
            projectId,
            enabled: true,
            settings: { url: old.url, autoSync: old.autoSync ?? false },
            lastSyncAt: old.lastSyncAt ?? null,
            lastSyncStatus: old.lastSyncStatus ?? null,
            lastSyncError: old.lastSyncError ?? null,
          }
          // Write in new format and keep legacy for backward compat
          writeProviderConfig(projectId, providerId, config)
          return config
        }
      }
    }

    return null
  } catch {
    return null
  }
}

export function writeProviderConfig(projectId: string, providerId: ProviderId, config: ProviderConfig) {
  localStorage.setItem(SYNC_KEY(projectId, providerId), JSON.stringify(config))

  // Also write legacy format for Google Sheets backward compat
  if (providerId === 'google-sheets' && config.settings.url) {
    localStorage.setItem(LEGACY_SHEETS_KEY(projectId), JSON.stringify({
      url: config.settings.url,
      autoSync: config.settings.autoSync ?? false,
      lastSyncAt: config.lastSyncAt,
      lastSyncStatus: config.lastSyncStatus,
      lastSyncError: config.lastSyncError,
    }))
  }
}

export function removeProviderConfig(projectId: string, providerId: ProviderId) {
  localStorage.removeItem(SYNC_KEY(projectId, providerId))
  if (providerId === 'google-sheets') {
    localStorage.removeItem(LEGACY_SHEETS_KEY(projectId))
  }
}

export function readGlobalConfig(providerId: ProviderId): Record<string, any> | null {
  try {
    const raw = localStorage.getItem(GLOBAL_KEY(providerId))
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

export function writeGlobalConfig(providerId: ProviderId, config: Record<string, any>) {
  localStorage.setItem(GLOBAL_KEY(providerId), JSON.stringify(config))
}

export function removeGlobalConfig(providerId: ProviderId) {
  localStorage.removeItem(GLOBAL_KEY(providerId))
}

/** Check if any sync provider is configured for a project */
export function hasAnySyncConfig(projectId: string): ProviderId[] {
  const configured: ProviderId[] = []
  const providers: ProviderId[] = ['google-sheets', 'github-issues', 'webhook', 'linear', 'trello', 'notion']

  for (const p of providers) {
    const config = readProviderConfig(projectId, p)
    if (config?.enabled) configured.push(p)
  }

  return configured
}

/** Legacy compatibility: check if Google Sheets is configured */
export function hasSyncConfig(projectId: string): boolean {
  const config = readProviderConfig(projectId, 'google-sheets')
  return !!config?.settings?.url
}
