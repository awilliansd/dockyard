import { useState, useMemo, useRef, useEffect } from 'react'
import { Search, ArrowUpDown } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ProjectCard, type TaskCounts } from './ProjectCard'
import { cn } from '@/lib/utils'
import type { Project } from '@/hooks/useProjects'

type SortOption = 'name' | 'lastModified' | 'lastOpened' | 'category' | 'tasks'

const sortLabels: Record<SortOption, string> = {
  name: 'A-Z',
  lastModified: 'Recent commit',
  lastOpened: 'Last opened',
  category: 'Category',
  tasks: 'Tasks',
}

interface ProjectListProps {
  projects: Project[]
  taskCounts?: Map<string, TaskCounts>
}

export function ProjectList({ projects, taskCounts }: ProjectListProps) {
  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null)
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false)
  const [sortBy, setSortBy] = useState<SortOption>('lastModified')
  const searchRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    searchRef.current?.focus()
  }, [])

  const categories = useMemo(() => {
    const cats = new Set(projects.map(p => p.category))
    return Array.from(cats).sort()
  }, [projects])

  const sortOptions: SortOption[] = ['name', 'lastModified', 'lastOpened', 'category', 'tasks']

  const cycleSortBy = () => {
    const idx = sortOptions.indexOf(sortBy)
    setSortBy(sortOptions[(idx + 1) % sortOptions.length])
  }

  const filtered = useMemo(() => {
    let result = projects

    if (search) {
      const q = search.toLowerCase()
      result = result.filter(p =>
        p.name.toLowerCase().includes(q) ||
        p.techStack.some(t => t.toLowerCase().includes(q))
      )
    }

    if (categoryFilter) {
      result = result.filter(p => p.category === categoryFilter)
    }

    if (showFavoritesOnly) {
      result = result.filter(p => p.favorite)
    }

    return [...result].sort((a, b) => {
      // Favorites first only when not sorting by time
      if (sortBy !== 'lastModified' && sortBy !== 'lastOpened') {
        if (a.favorite !== b.favorite) return a.favorite ? -1 : 1
      }

      switch (sortBy) {
        case 'lastModified': {
          const da = a.lastCommitDate ? new Date(a.lastCommitDate).getTime() : 0
          const db = b.lastCommitDate ? new Date(b.lastCommitDate).getTime() : 0
          return db - da // most recent first
        }
        case 'lastOpened': {
          const da = a.lastOpenedAt ? new Date(a.lastOpenedAt).getTime() : 0
          const db = b.lastOpenedAt ? new Date(b.lastOpenedAt).getTime() : 0
          return db - da
        }
        case 'category': {
          const cc = a.category.localeCompare(b.category)
          if (cc !== 0) return cc
          return a.name.localeCompare(b.name)
        }
        case 'tasks': {
          const ta = taskCounts?.get(a.id)
          const tb = taskCounts?.get(b.id)
          const activeA = (ta?.inbox || 0) + (ta?.inProgress || 0)
          const activeB = (tb?.inbox || 0) + (tb?.inProgress || 0)
          return activeB - activeA // most active tasks first
        }
        default:
          return a.name.localeCompare(b.name)
      }
    })
  }, [projects, search, categoryFilter, showFavoritesOnly, sortBy, taskCounts])

  const hasFilters = search || categoryFilter || showFavoritesOnly

  return (
    <div className="space-y-3">
      {/* Toolbar */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            ref={searchRef}
            placeholder="Search projects or tech..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="h-8 pl-8 text-sm"
          />
        </div>
        <Button
          variant="outline"
          size="sm"
          className="gap-1.5 text-xs h-8"
          onClick={cycleSortBy}
        >
          <ArrowUpDown className="h-3 w-3" />
          {sortLabels[sortBy]}
        </Button>
        <Button
          variant={showFavoritesOnly ? 'default' : 'outline'}
          size="sm"
          className="h-8 text-xs"
          onClick={() => setShowFavoritesOnly(!showFavoritesOnly)}
        >
          Favorites
        </Button>
        {hasFilters && (
          <span className="text-[11px] text-muted-foreground/50 ml-1">
            {filtered.length} of {projects.length}
          </span>
        )}
      </div>

      {/* Categories */}
      {categories.length > 1 && (
        <div className="flex flex-wrap gap-1">
          <Badge
            variant={categoryFilter === null ? 'default' : 'outline'}
            className="cursor-pointer text-[10px]"
            onClick={() => setCategoryFilter(null)}
          >
            All ({projects.length})
          </Badge>
          {categories.map(cat => {
            const count = projects.filter(p => p.category === cat).length
            return (
              <Badge
                key={cat}
                variant={categoryFilter === cat ? 'default' : 'outline'}
                className="cursor-pointer text-[10px]"
                onClick={() => setCategoryFilter(cat === categoryFilter ? null : cat)}
              >
                {cat} ({count})
              </Badge>
            )
          })}
        </div>
      )}

      {/* Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-2.5">
        {filtered.map(project => (
          <ProjectCard
            key={project.id}
            project={project}
            taskCounts={taskCounts?.get(project.id)}
          />
        ))}
      </div>

      {filtered.length === 0 && (
        <div className="text-center py-12 text-sm text-muted-foreground">
          No projects found
        </div>
      )}
    </div>
  )
}
