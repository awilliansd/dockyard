import type { SyncProvider, ProviderId, ProviderDefinition } from './types'

const providers = new Map<ProviderId, SyncProvider>()

export function registerProvider(provider: SyncProvider) {
  providers.set(provider.definition.id, provider)
}

export function getProvider(id: ProviderId): SyncProvider | undefined {
  return providers.get(id)
}

export function getAllProviders(): SyncProvider[] {
  return Array.from(providers.values())
}

export function getAvailableProviders(): SyncProvider[] {
  return getAllProviders().filter(p => p.definition.available)
}

export function getAllDefinitions(): ProviderDefinition[] {
  return getAllProviders().map(p => p.definition)
}
