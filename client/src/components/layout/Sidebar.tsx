import { useState, useCallback, useMemo } from 'react'
import { Link, useLocation } from 'react-router-dom'
import {
  LayoutDashboard, RefreshCw, Settings, ClipboardList, PanelLeftClose, PanelLeft,
  Search, ChevronRight, ScrollText, HelpCircle
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { AboutModal } from './AboutModal'
import { useProjects, type Project } from '@/hooks/useProjects'
import { useAllTasks } from '@/hooks/useTasks'
import { useTabs } from '@/hooks/useTabs'
import { useRefreshProjects } from '@/hooks/useProjects'

// --- Avatar ---
const avatarColors = [
  'bg-red-500/15 text-red-400',
  'bg-orange-500/15 text-orange-400',
  'bg-amber-500/15 text-amber-400',
  'bg-yellow-500/15 text-yellow-400',
  'bg-lime-500/15 text-lime-400',
  'bg-green-500/15 text-green-400',
  'bg-emerald-500/15 text-emerald-400',
  'bg-teal-500/15 text-teal-400',
  'bg-cyan-500/15 text-cyan-400',
  'bg-sky-500/15 text-sky-400',
  'bg-blue-500/15 text-blue-400',
  'bg-indigo-500/15 text-indigo-400',
  'bg-violet-500/15 text-violet-400',
  'bg-purple-500/15 text-purple-400',
  'bg-fuchsia-500/15 text-fuchsia-400',
  'bg-pink-500/15 text-pink-400',
  'bg-rose-500/15 text-rose-400',
]

function projectColor(name: string) {
  let hash = 0
  for (let i = 0; i < name.length; i++) hash = ((hash << 5) - hash + name.charCodeAt(i)) | 0
  return avatarColors[Math.abs(hash) % avatarColors.length]
}

function ProjectAvatar({ name, className }: { name: string; className?: string }) {
  return (
    <span className={cn('flex items-center justify-center rounded text-[10px] font-bold', projectColor(name), className)}>
      {name.charAt(0).toUpperCase()}
    </span>
  )
}

// --- Collapsed project item ---
function CollapsedProjectItem({ project: p, location, openTab, taskCount, isActive }: {
  project: Project
  location: { pathname: string }
  openTab: (id: string) => void
  taskCount?: number
  isActive?: boolean
}) {
  const changes = (p.gitStaged ?? 0) + (p.gitUnstaged ?? 0) + (p.gitUntracked ?? 0)
  const hasGitPending = changes > 0 || (p.gitAhead ?? 0) > 0

  const tooltipParts = [p.name]
  if (taskCount) tooltipParts.push(`${taskCount} task${taskCount > 1 ? 's' : ''}`)
  if (hasGitPending) tooltipParts.push(`${changes} changes`)

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          onClick={() => openTab(p.id)}
          className={cn(
            'relative flex items-center justify-center w-8 h-8 rounded-md transition-colors',
            location.pathname === `/project/${p.id}` ? 'ring-1 ring-primary/50' : 'hover:bg-accent/50'
          )}
        >
          <ProjectAvatar name={p.name} className="w-7 h-7" />
          {isActive && (
            <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-yellow-400 ring-2 ring-card" />
          )}
          {!isActive && hasGitPending && (
            <span className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 rounded-full bg-orange-400" />
          )}
        </button>
      </TooltipTrigger>
      <TooltipContent side="right">{tooltipParts.join(' · ')}</TooltipContent>
    </Tooltip>
  )
}

// --- Expanded project item ---
function ExpandedProjectItem({ project: p, location, openTab, taskCount, isActive }: {
  project: Project
  location: { pathname: string }
  openTab: (id: string) => void
  taskCount?: number
  isActive?: boolean
}) {
  const isCurrent = location.pathname === `/project/${p.id}`
  const changes = (p.gitStaged ?? 0) + (p.gitUnstaged ?? 0) + (p.gitUntracked ?? 0)

  return (
    <button
      onClick={() => openTab(p.id)}
      className={cn(
        'flex items-center gap-2 px-2 py-1.5 rounded-md text-[13px] transition-colors w-full text-left group',
        isCurrent
          ? 'bg-accent text-accent-foreground'
          : 'text-muted-foreground hover:bg-accent/50 hover:text-foreground'
      )}
    >
      <ProjectAvatar name={p.name} className="w-5 h-5 shrink-0" />
      <span className="truncate flex-1">{p.name}</span>
      <div className="flex items-center gap-1 shrink-0">
        {isActive && (
          <span className="w-1.5 h-1.5 rounded-full bg-yellow-400 shrink-0" />
        )}
        {!isActive && changes > 0 && (
          <span className="w-1.5 h-1.5 rounded-full bg-orange-400 shrink-0" />
        )}
        {taskCount !== undefined && taskCount > 0 && (
          <span className="text-[10px] text-muted-foreground/60 tabular-nums min-w-[14px] text-right">
            {taskCount}
          </span>
        )}
      </div>
    </button>
  )
}

// --- Section ---
const SECTION_STORAGE_KEY = 'shipyard:sidebar-sections'

function loadSectionState(): Record<string, boolean> {
  try {
    const raw = localStorage.getItem(SECTION_STORAGE_KEY)
    if (raw) return JSON.parse(raw)
  } catch {}
  return {}
}

function SectionHeader({ label, count, isOpen, onToggle }: {
  label: string
  count: number
  isOpen: boolean
  onToggle: () => void
}) {
  return (
    <button
      onClick={onToggle}
      className="flex items-center gap-1 w-full px-2 pt-4 pb-1 text-[11px] font-medium text-muted-foreground/50 hover:text-muted-foreground transition-colors"
    >
      <ChevronRight className={cn('h-3 w-3 transition-transform duration-150', isOpen && 'rotate-90')} />
      <span>{label}</span>
      <span className="ml-auto text-[10px] text-muted-foreground/30">{count}</span>
    </button>
  )
}


// --- Main Sidebar ---
interface SidebarProps {
  collapsed: boolean
  onToggle: () => void
  width?: number
}

function openGlobalSearch() {
  document.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true, bubbles: true }))
}

export function Sidebar({ collapsed, onToggle, width }: SidebarProps) {
  const location = useLocation()
  const { data: projects } = useProjects()
  const { data: tasks } = useAllTasks()
  const refreshProjects = useRefreshProjects()
  const { openTab } = useTabs()

  const [sectionState, setSectionState] = useState<Record<string, boolean>>(loadSectionState)
  const toggleSection = useCallback((key: string) => {
    setSectionState(prev => {
      const next = { ...prev, [key]: !prev[key] }
      localStorage.setItem(SECTION_STORAGE_KEY, JSON.stringify(next))
      return next
    })
  }, [])
  const isSectionOpen = (key: string, defaultOpen: boolean) => {
    return sectionState[key] !== undefined ? sectionState[key] : defaultOpen
  }

  const { pendingByProject, inProgressProjects } = useMemo(() => {
    const pending = new Map<string, number>()
    const inProgress = new Set<string>()
    if (tasks) {
      for (const t of tasks) {
        if (t.status === 'todo' || t.status === 'in_progress') {
          pending.set(t.projectId, (pending.get(t.projectId) || 0) + 1)
        }
        if (t.status === 'in_progress') {
          inProgress.add(t.projectId)
        }
      }
    }
    return { pendingByProject: pending, inProgressProjects: inProgress }
  }, [tasks])

  // Categorize projects
  const favorites = useMemo(() => projects?.filter(p => p.favorite) || [], [projects])
  const favoriteIds = useMemo(() => new Set(favorites.map(p => p.id)), [favorites])

  const activeProjects = useMemo(() =>
    projects?.filter(p => !favoriteIds.has(p.id) && inProgressProjects.has(p.id)) || [],
    [projects, favoriteIds, inProgressProjects]
  )
  const activeIds = useMemo(() => new Set(activeProjects.map(p => p.id)), [activeProjects])

  const otherProjects = useMemo(() =>
    projects?.filter(p => !favoriteIds.has(p.id) && !activeIds.has(p.id)) || [],
    [projects, favoriteIds, activeIds]
  )

  const totalActive = tasks?.filter(t => t.status === 'backlog' || t.status === 'todo' || t.status === 'in_progress').length || 0

  // --- Collapsed ---
  if (collapsed) {
    return (
      <aside className="w-12 border-r bg-card/30 flex flex-col h-screen shrink-0">
        <div className="p-2 flex justify-center">
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onToggle}>
            <PanelLeft className="h-4 w-4 text-muted-foreground" />
          </Button>
        </div>

        <nav className="flex-1 overflow-y-auto py-1 flex flex-col items-center gap-0.5 scrollbar-dark">
          <Tooltip>
            <TooltipTrigger asChild>
              <Link
                to="/"
                className={cn(
                  'flex items-center justify-center w-8 h-8 rounded-md transition-colors',
                  location.pathname === '/' ? 'bg-accent text-foreground' : 'text-muted-foreground hover:bg-accent/50'
                )}
              >
                <LayoutDashboard className="h-4 w-4" />
              </Link>
            </TooltipTrigger>
            <TooltipContent side="right">Dashboard</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Link
                to="/tasks"
                className={cn(
                  'relative flex items-center justify-center w-8 h-8 rounded-md transition-colors',
                  location.pathname === '/tasks' ? 'bg-accent text-foreground' : 'text-muted-foreground hover:bg-accent/50'
                )}
              >
                <ClipboardList className="h-4 w-4" />
                {totalActive > 0 && (
                  <span className="absolute -top-0.5 -right-1 bg-primary text-primary-foreground text-[8px] rounded-full min-w-[14px] h-3.5 flex items-center justify-center font-medium px-0.5">
                    {totalActive}
                  </span>
                )}
              </Link>
            </TooltipTrigger>
            <TooltipContent side="right">All Tasks</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={openGlobalSearch}
                className="flex items-center justify-center w-8 h-8 rounded-md transition-colors text-muted-foreground hover:bg-accent/50"
              >
                <Search className="h-4 w-4" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="right">Search (Ctrl+K)</TooltipContent>
          </Tooltip>

          <div className="w-5 border-t my-1.5" />

          {/* All projects in priority order: favorites → active → other */}
          {favorites.map(p => (
            <CollapsedProjectItem
              key={p.id} project={p} location={location} openTab={openTab}
              taskCount={pendingByProject.get(p.id)}
              isActive={inProgressProjects.has(p.id)}
            />
          ))}
          {activeProjects.map(p => (
            <CollapsedProjectItem
              key={p.id} project={p} location={location} openTab={openTab}
              taskCount={pendingByProject.get(p.id)} isActive
            />
          ))}
          {otherProjects.length > 0 && favorites.length + activeProjects.length > 0 && (
            <div className="w-5 border-t my-1.5" />
          )}
          {otherProjects.map(p => (
            <CollapsedProjectItem
              key={p.id} project={p} location={location} openTab={openTab}
              taskCount={pendingByProject.get(p.id)}
            />
          ))}
        </nav>

        <div className="p-1.5 border-t flex flex-col items-center gap-0.5">
          <Tooltip>
            <TooltipTrigger asChild>
              <Link to="/help" className={cn(
                'flex items-center justify-center w-8 h-8 rounded-md transition-colors',
                location.pathname === '/help' ? 'bg-accent text-foreground' : 'text-muted-foreground hover:bg-accent/50'
              )}>
                <HelpCircle className="h-3.5 w-3.5" />
              </Link>
            </TooltipTrigger>
            <TooltipContent side="right">Help</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Link to="/settings" className={cn(
                'flex items-center justify-center w-8 h-8 rounded-md transition-colors',
                location.pathname === '/settings' ? 'bg-accent text-foreground' : 'text-muted-foreground hover:bg-accent/50'
              )}>
                <Settings className="h-3.5 w-3.5" />
              </Link>
            </TooltipTrigger>
            <TooltipContent side="right">Settings</TooltipContent>
          </Tooltip>
        </div>
      </aside>
    )
  }

  // --- Expanded ---
  return (
    <aside
      className="border-r bg-card/30 flex flex-col h-screen shrink-0"
      style={width ? { width } : undefined}
    >
      {/* Header */}
      <div className="h-9 px-3 flex items-center justify-between shrink-0">
        <Link to="/" className="flex items-center gap-1.5 text-[13px] font-semibold text-foreground/80 hover:text-foreground transition-colors">
          Shipyard
        </Link>
        <div className="flex items-center">
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={() => refreshProjects.mutate()}
            disabled={refreshProjects.isPending}
            title="Refresh"
          >
            <RefreshCw className={cn('h-3 w-3 text-muted-foreground', refreshProjects.isPending && 'animate-spin')} />
          </Button>
          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={onToggle} title="Collapse">
            <PanelLeftClose className="h-3.5 w-3.5 text-muted-foreground" />
          </Button>
        </div>
      </div>

      {/* Search trigger */}
      <div className="px-2 pb-2">
        <button
          onClick={openGlobalSearch}
          className="flex items-center gap-2 h-7 w-full rounded-md bg-accent/50 px-2.5 text-[12px] text-muted-foreground/50 hover:bg-accent hover:text-muted-foreground transition-colors"
        >
          <Search className="h-3 w-3 shrink-0" />
          <span className="flex-1 text-left">Search...</span>
          <kbd className="text-[9px] text-muted-foreground/30 font-mono">Ctrl+K</kbd>
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-2 pb-2 scrollbar-dark">
        {/* Main nav */}
        <div className="space-y-0.5">
          <Link
            to="/"
            className={cn(
              'flex items-center gap-2 px-2 py-1.5 rounded-md text-[13px] transition-colors',
              location.pathname === '/'
                ? 'bg-accent text-foreground font-medium'
                : 'text-muted-foreground hover:bg-accent/50 hover:text-foreground'
            )}
          >
            <LayoutDashboard className="h-3.5 w-3.5" />
            Dashboard
          </Link>

          <Link
            to="/tasks"
            className={cn(
              'flex items-center gap-2 px-2 py-1.5 rounded-md text-[13px] transition-colors',
              location.pathname === '/tasks'
                ? 'bg-accent text-foreground font-medium'
                : 'text-muted-foreground hover:bg-accent/50 hover:text-foreground'
            )}
          >
            <ClipboardList className="h-3.5 w-3.5" />
            Tasks
            {totalActive > 0 && (
              <span className="text-[10px] text-muted-foreground/50 ml-auto tabular-nums">
                {totalActive}
              </span>
            )}
          </Link>
        </div>

        {/* Favorites */}
        {favorites.length > 0 && (
          <div>
            <SectionHeader
              label="Favorites"
              count={favorites.length}
              isOpen={isSectionOpen('favorites', true)}
              onToggle={() => toggleSection('favorites')}
            />
            {isSectionOpen('favorites', true) && (
              <div className="space-y-0.5">
                {favorites.map(p => (
                  <ExpandedProjectItem
                    key={p.id} project={p} location={location} openTab={openTab}
                    taskCount={pendingByProject.get(p.id)}
                    isActive={inProgressProjects.has(p.id)}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {/* Active */}
        {activeProjects.length > 0 && (
          <div>
            <SectionHeader
              label="Active"
              count={activeProjects.length}
              isOpen={isSectionOpen('active', true)}
              onToggle={() => toggleSection('active')}
            />
            {isSectionOpen('active', true) && (
              <div className="space-y-0.5">
                {activeProjects.map(p => (
                  <ExpandedProjectItem
                    key={p.id} project={p} location={location} openTab={openTab}
                    taskCount={pendingByProject.get(p.id)} isActive
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {/* Other projects */}
        {otherProjects.length > 0 && (
          <div>
            <SectionHeader
              label="Projects"
              count={otherProjects.length}
              isOpen={isSectionOpen('projects', otherProjects.length <= 10)}
              onToggle={() => toggleSection('projects')}
            />
            {isSectionOpen('projects', otherProjects.length <= 10) && (
              <div className="space-y-0.5">
                {otherProjects.map(p => (
                  <ExpandedProjectItem
                    key={p.id} project={p} location={location} openTab={openTab}
                    taskCount={pendingByProject.get(p.id)}
                  />
                ))}
              </div>
            )}
          </div>
        )}
      </nav>

      {/* Footer - minimal */}
      <div className="px-2 py-2 border-t flex items-center justify-between">
        <span className="text-[10px] text-muted-foreground/30 pl-1">{projects?.length || 0} projects</span>
        <div className="flex items-center">
          <Tooltip>
            <TooltipTrigger asChild>
              <Link to="/logs" className={cn(
                'flex items-center justify-center w-6 h-6 rounded transition-colors',
                location.pathname === '/logs' ? 'text-foreground' : 'text-muted-foreground/40 hover:text-muted-foreground'
              )}>
                <ScrollText className="h-3 w-3" />
              </Link>
            </TooltipTrigger>
            <TooltipContent side="top">Logs</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Link to="/help" className={cn(
                'flex items-center justify-center w-6 h-6 rounded transition-colors',
                location.pathname === '/help' ? 'text-foreground' : 'text-muted-foreground/40 hover:text-muted-foreground'
              )}>
                <HelpCircle className="h-3 w-3" />
              </Link>
            </TooltipTrigger>
            <TooltipContent side="top">Help</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Link to="/settings" className={cn(
                'flex items-center justify-center w-6 h-6 rounded transition-colors',
                location.pathname === '/settings' ? 'text-foreground' : 'text-muted-foreground/40 hover:text-muted-foreground'
              )}>
                <Settings className="h-3 w-3" />
              </Link>
            </TooltipTrigger>
            <TooltipContent side="top">Settings</TooltipContent>
          </Tooltip>
        </div>
      </div>
    </aside>
  )
}
