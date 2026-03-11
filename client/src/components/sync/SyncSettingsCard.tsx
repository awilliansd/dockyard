import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import {
  Sheet, FileJson, FileText, Github, Webhook, Layers,
  LayoutDashboard, BookOpen, CheckCircle2, Clock, ExternalLink,
} from 'lucide-react'
import { getAllDefinitions } from '@/lib/sync/registry'
import { hasAnySyncConfig } from '@/lib/sync/configStore'
import type { ProviderDefinition, ProviderId } from '@/lib/sync/types'
import type { Project } from '@/hooks/useProjects'
import { cn } from '@/lib/utils'

// Import providers to ensure registration
import '@/lib/sync/providers'

const ICON_MAP: Record<string, React.ElementType> = {
  Sheet, FileJson, FileText, Github, Webhook, Layers,
  LayoutDashboard, BookOpen,
}

interface SyncSettingsCardProps {
  projects: Project[]
}

function getProjectSyncCount(providerId: ProviderId, projects: Project[]): number {
  let count = 0
  for (const p of projects) {
    const configured = hasAnySyncConfig(p.id)
    if (configured.includes(providerId)) count++
  }
  return count
}

function ProviderCard({ def, projects }: { def: ProviderDefinition; projects: Project[] }) {
  const Icon = ICON_MAP[def.icon] || FileJson
  const syncCount = def.available ? getProjectSyncCount(def.id, projects) : 0
  const isConfigured = syncCount > 0
  const isExport = def.direction === 'export-only'
  const isComingSoon = !def.available

  return (
    <div className={cn(
      'flex items-start gap-3 p-4 rounded-lg border transition-colors',
      isComingSoon ? 'opacity-50' : 'hover:border-primary/30',
    )}>
      <div className={cn(
        'h-9 w-9 rounded-md flex items-center justify-center shrink-0',
        isConfigured ? 'bg-emerald-500/10 text-emerald-500' :
        isExport ? 'bg-blue-500/10 text-blue-500' :
        'bg-muted text-muted-foreground'
      )}>
        <Icon className="h-4.5 w-4.5" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">{def.name}</span>
          {isConfigured && (
            <Badge variant="outline" className="text-[10px] px-1.5 py-0 text-emerald-500 border-emerald-500/30">
              <CheckCircle2 className="h-2.5 w-2.5 mr-0.5" />
              {syncCount} project{syncCount > 1 ? 's' : ''}
            </Badge>
          )}
          {isExport && !isComingSoon && (
            <Badge variant="outline" className="text-[10px] px-1.5 py-0 text-blue-500 border-blue-500/30">
              Export
            </Badge>
          )}
          {isComingSoon && (
            <Badge variant="outline" className="text-[10px] px-1.5 py-0">
              <Clock className="h-2.5 w-2.5 mr-0.5" />
              Phase {def.phase}
            </Badge>
          )}
          {def.direction === 'bidirectional' && !isComingSoon && (
            <Badge variant="outline" className="text-[10px] px-1.5 py-0 text-muted-foreground">
              Bidirectional
            </Badge>
          )}
          {def.direction === 'notify-only' && !isComingSoon && (
            <Badge variant="outline" className="text-[10px] px-1.5 py-0 text-muted-foreground">
              Notify
            </Badge>
          )}
        </div>
        <p className="text-[11px] text-muted-foreground mt-0.5">{def.description}</p>
        {!isComingSoon && !isExport && (
          <p className="text-[10px] text-muted-foreground/60 mt-1">
            Configure per-project in each project's workspace
          </p>
        )}
        {isExport && (
          <p className="text-[10px] text-muted-foreground/60 mt-1">
            Available in each project's workspace toolbar
          </p>
        )}
      </div>
    </div>
  )
}

export function SyncSettingsCard({ projects }: SyncSettingsCardProps) {
  const definitions = getAllDefinitions()

  const available = definitions.filter(d => d.available)
  const coming = definitions.filter(d => !d.available)

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Integrations</CardTitle>
        <CardDescription>
          Connect external services to sync tasks. Bidirectional providers are configured per-project in each workspace.
          Export providers are available in the task toolbar.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Available providers */}
        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Available</p>
          <div className="grid grid-cols-1 gap-2">
            {available.map(def => (
              <ProviderCard key={def.id} def={def} projects={projects} />
            ))}
          </div>
        </div>

        {/* Coming soon */}
        {coming.length > 0 && (
          <div className="space-y-2 pt-2">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Coming Soon</p>
            <div className="grid grid-cols-1 gap-2">
              {coming.map(def => (
                <ProviderCard key={def.id} def={def} projects={projects} />
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
