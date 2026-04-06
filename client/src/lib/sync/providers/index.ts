import { registerProvider } from '../registry'
import type { ProviderDefinition } from '../types'
import { googleSheetsProvider } from './googleSheets'
import { jsonExportProvider } from './jsonExport'
import { markdownExportProvider } from './markdownExport'

// Phase 1: Available now
registerProvider(googleSheetsProvider)
registerProvider(jsonExportProvider)
registerProvider(markdownExportProvider)

// Phase 2: Coming soon (definitions only, no implementation yet)
const phase2Definitions: ProviderDefinition[] = [
  {
    id: 'github-issues',
    name: 'GitHub Issues',
    description: 'Sync tasks with GitHub Issues — bidirectional, with label mapping',
    icon: 'Github',
    direction: 'bidirectional',
    requiresServer: true,
    phase: 2,
    available: false,
    configFields: [
      { key: 'token', label: 'Personal Access Token', type: 'password', placeholder: 'ghp_...', required: true, helpText: 'Generate at github.com/settings/tokens' },
      { key: 'repo', label: 'Repository', type: 'text', placeholder: 'owner/repo', required: true },
      { key: 'label', label: 'Filter label', type: 'text', placeholder: 'dockyard', required: false, helpText: 'Only sync issues with this label' },
    ],
  },
  {
    id: 'webhook',
    name: 'Webhooks',
    description: 'Send task events to Discord, Slack, n8n, or any URL',
    icon: 'Webhook',
    direction: 'notify-only',
    requiresServer: true,
    phase: 2,
    available: false,
    configFields: [
      { key: 'url', label: 'Webhook URL', type: 'url', placeholder: 'https://...', required: true },
      { key: 'format', label: 'Format', type: 'select', required: false, options: [
        { value: 'json', label: 'JSON (raw)' },
        { value: 'discord', label: 'Discord (embed)' },
        { value: 'slack', label: 'Slack (block kit)' },
      ]},
      { key: 'events', label: 'Events to send', type: 'text', placeholder: 'created,updated,status_changed', required: false },
    ],
  },
]

// Phase 3: Future
const phase3Definitions: ProviderDefinition[] = [
  {
    id: 'linear',
    name: 'Linear',
    description: 'Sync tasks with Linear issues — ideal for dev teams',
    icon: 'Layers',
    direction: 'bidirectional',
    requiresServer: true,
    phase: 3,
    available: false,
    configFields: [
      { key: 'apiKey', label: 'API Key', type: 'password', required: true },
      { key: 'teamId', label: 'Team', type: 'text', required: true },
    ],
  },
  {
    id: 'trello',
    name: 'Trello',
    description: 'Sync tasks with Trello cards and boards',
    icon: 'LayoutDashboard',
    direction: 'bidirectional',
    requiresServer: true,
    phase: 3,
    available: false,
    configFields: [
      { key: 'apiKey', label: 'API Key', type: 'password', required: true },
      { key: 'token', label: 'Token', type: 'password', required: true },
      { key: 'boardId', label: 'Board ID', type: 'text', required: true },
    ],
  },
  {
    id: 'notion',
    name: 'Notion',
    description: 'Sync tasks with a Notion database',
    icon: 'BookOpen',
    direction: 'bidirectional',
    requiresServer: true,
    phase: 3,
    available: false,
    configFields: [
      { key: 'token', label: 'Integration Token', type: 'password', required: true },
      { key: 'databaseId', label: 'Database ID', type: 'text', required: true },
    ],
  },
]

// Register placeholder providers for definitions display
for (const def of [...phase2Definitions, ...phase3Definitions]) {
  registerProvider({ definition: def })
}
