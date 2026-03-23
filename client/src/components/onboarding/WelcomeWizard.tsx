import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { FolderSearch, Plus, ArrowRight, ArrowLeft, CheckCircle2, Terminal, ClipboardList, GitBranch, Download, Upload, Cloud, Layers, Keyboard, HelpCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { FolderBrowser } from '@/components/ui/folder-browser'
import { Badge } from '@/components/ui/badge'
import { useProjects } from '@/hooks/useProjects'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

const ONBOARDING_KEY = 'shipyard:onboarding-complete'

interface ScannedProject {
  path: string
  name: string
  techStack: string[]
  isGitRepo: boolean
}

export function useOnboarding() {
  const { data: projects } = useProjects()
  const [dismissed, setDismissed] = useState(() => {
    try { return localStorage.getItem(ONBOARDING_KEY) === 'true' } catch { return false }
  })

  const shouldShow = !dismissed && (projects?.length === 0 || projects === undefined)

  const complete = () => {
    localStorage.setItem(ONBOARDING_KEY, 'true')
    setDismissed(true)
  }

  const reset = () => {
    localStorage.removeItem(ONBOARDING_KEY)
    setDismissed(false)
  }

  return { shouldShow, complete, reset }
}

interface WelcomeWizardProps {
  onComplete: () => void
}

export function WelcomeWizard({ onComplete }: WelcomeWizardProps) {
  const [step, setStep] = useState(0)
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  // Step 1 - scan state
  const [scanBrowserOpen, setScanBrowserOpen] = useState(false)
  const [addBrowserOpen, setAddBrowserOpen] = useState(false)
  const [scannedProjects, setScannedProjects] = useState<ScannedProject[]>([])
  const [selectedPaths, setSelectedPaths] = useState<Set<string>>(new Set())
  const [hasAddedProjects, setHasAddedProjects] = useState(false)

  const scanMutation = useMutation({
    mutationFn: (directory: string) => api.scanDirectory(directory),
    onSuccess: (data) => {
      setScannedProjects(data.projects)
      setSelectedPaths(new Set(data.projects.map((p: ScannedProject) => p.path)))
    },
  })

  const addMutation = useMutation({
    mutationFn: (paths: string[]) => api.addProjects(paths),
    onSuccess: (data) => {
      queryClient.setQueryData(['projects'], data.projects)
      queryClient.invalidateQueries({ queryKey: ['projects'] })
      setHasAddedProjects(true)
      setScannedProjects([])
      toast.success(`Added ${data.projects.length} projects!`)
    },
  })

  const totalSteps = 4

  const handleFinish = () => {
    onComplete()
    navigate('/')
  }

  return (
    <div className="fixed inset-0 z-50 bg-background/95 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="w-full max-w-2xl">
        {/* Progress dots */}
        <div className="flex items-center justify-center gap-2 mb-8">
          {Array.from({ length: totalSteps }).map((_, i) => (
            <div
              key={i}
              className={cn(
                'h-1.5 rounded-full transition-all duration-300',
                i === step ? 'w-8 bg-primary' : i < step ? 'w-4 bg-primary/50' : 'w-4 bg-muted'
              )}
            />
          ))}
        </div>

        {/* Step content */}
        <div className="bg-card border rounded-xl p-8 shadow-lg min-h-[420px] flex flex-col">
          {step === 0 && (
            <StepWelcome />
          )}
          {step === 1 && (
            <StepAddProjects
              scanBrowserOpen={scanBrowserOpen}
              setScanBrowserOpen={setScanBrowserOpen}
              addBrowserOpen={addBrowserOpen}
              setAddBrowserOpen={setAddBrowserOpen}
              scannedProjects={scannedProjects}
              selectedPaths={selectedPaths}
              setSelectedPaths={setSelectedPaths}
              scanMutation={scanMutation}
              addMutation={addMutation}
              hasAddedProjects={hasAddedProjects}
              onScan={(path) => scanMutation.mutate(path)}
              onAdd={(paths) => addMutation.mutate(paths)}
              onAddFolder={(paths) => {
                addMutation.mutate(paths, {
                  onSuccess: () => setHasAddedProjects(true),
                })
              }}
            />
          )}
          {step === 2 && (
            <StepFeatures />
          )}
          {step === 3 && (
            <StepReady />
          )}

          {/* Navigation */}
          <div className="flex items-center justify-between mt-auto pt-6">
            {step > 0 ? (
              <Button variant="ghost" onClick={() => setStep(s => s - 1)} className="gap-2">
                <ArrowLeft className="h-4 w-4" />
                Back
              </Button>
            ) : (
              <Button variant="ghost" onClick={handleFinish} className="text-muted-foreground">
                Skip setup
              </Button>
            )}
            {step < totalSteps - 1 ? (
              <Button onClick={() => setStep(s => s + 1)} className="gap-2">
                {step === 1 && !hasAddedProjects ? 'Skip for now' : 'Next'}
                <ArrowRight className="h-4 w-4" />
              </Button>
            ) : (
              <Button onClick={handleFinish} className="gap-2">
                <CheckCircle2 className="h-4 w-4" />
                Get Started
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

function StepWelcome() {
  return (
    <div className="flex-1 flex flex-col items-center justify-center text-center space-y-6">
      <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center">
        <svg viewBox="0 0 32 32" className="w-10 h-10">
          <defs>
            <linearGradient id="wg" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#6366f1"/>
              <stop offset="100%" stopColor="#8b5cf6"/>
            </linearGradient>
          </defs>
          <rect width="32" height="32" rx="8" fill="url(#wg)"/>
          <path d="M8 10h6v2H8zM8 14h10v2H8zM8 18h8v2H8zM18 10h6v12H18z" fill="white" opacity="0.9"/>
          <rect x="20" y="12" width="2" height="2" fill="url(#wg)" rx="0.5"/>
          <rect x="20" y="16" width="2" height="2" fill="url(#wg)" rx="0.5"/>
        </svg>
      </div>

      <div>
        <h1 className="text-2xl font-bold mb-2">Welcome to Shipyard</h1>
        <p className="text-muted-foreground max-w-md">
          Your local development dashboard for managing projects, tasks, git, and terminals — all in one place.
        </p>
      </div>

      <div className="grid grid-cols-4 gap-3 w-full max-w-lg pt-4">
        <Feature icon={<ClipboardList className="h-5 w-5" />} label="Task Kanban" />
        <Feature icon={<GitBranch className="h-5 w-5" />} label="Git Panel" />
        <Feature icon={<Terminal className="h-5 w-5" />} label="Terminal" />
        <Feature icon={<Layers className="h-5 w-5" />} label="Multi-tab" />
      </div>
    </div>
  )
}

function Feature({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <div className="flex flex-col items-center gap-2 p-3 rounded-lg bg-muted/50">
      <span className="text-primary">{icon}</span>
      <span className="text-xs text-muted-foreground">{label}</span>
    </div>
  )
}

interface StepAddProjectsProps {
  scanBrowserOpen: boolean
  setScanBrowserOpen: (open: boolean) => void
  addBrowserOpen: boolean
  setAddBrowserOpen: (open: boolean) => void
  scannedProjects: ScannedProject[]
  selectedPaths: Set<string>
  setSelectedPaths: (paths: Set<string>) => void
  scanMutation: any
  addMutation: any
  hasAddedProjects: boolean
  onScan: (path: string) => void
  onAdd: (paths: string[]) => void
  onAddFolder: (paths: string[]) => void
}

function StepAddProjects({
  scanBrowserOpen, setScanBrowserOpen,
  addBrowserOpen, setAddBrowserOpen,
  scannedProjects, selectedPaths, setSelectedPaths,
  scanMutation, addMutation,
  hasAddedProjects,
  onScan, onAdd, onAddFolder,
}: StepAddProjectsProps) {
  const toggleSelect = (path: string) => {
    const next = new Set(selectedPaths)
    if (next.has(path)) next.delete(path)
    else next.add(path)
    setSelectedPaths(next)
  }

  return (
    <div className="flex-1 space-y-4">
      <div>
        <h2 className="text-xl font-bold mb-1">Add Your Projects</h2>
        <p className="text-sm text-muted-foreground">
          Point Shipyard to your project folders. It will detect git repos and tech stacks automatically.
        </p>
      </div>

      <div className="flex gap-2">
        <Button onClick={() => setScanBrowserOpen(true)} variant="outline" className="gap-2 flex-1">
          <FolderSearch className="h-4 w-4" />
          Scan a folder
        </Button>
        <Button onClick={() => setAddBrowserOpen(true)} variant="outline" className="gap-2 flex-1">
          <Plus className="h-4 w-4" />
          Add folder
        </Button>
      </div>

      {hasAddedProjects && !scannedProjects.length && (
        <div className="flex items-center gap-2 p-4 rounded-lg bg-green-500/10 border border-green-500/20">
          <CheckCircle2 className="h-5 w-5 text-green-500 shrink-0" />
          <p className="text-sm text-green-400">Projects added! You can add more or continue.</p>
        </div>
      )}

      {scanMutation.isPending && (
        <div className="text-sm text-muted-foreground text-center py-4">Scanning...</div>
      )}

      {scannedProjects.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">
              Found {scannedProjects.length} projects
            </span>
            <Button
              size="sm"
              className="h-7 text-xs gap-1"
              onClick={() => onAdd(Array.from(selectedPaths))}
              disabled={selectedPaths.size === 0 || addMutation.isPending}
            >
              <Plus className="h-3.5 w-3.5" />
              Add selected ({selectedPaths.size})
            </Button>
          </div>

          <div className="border rounded-lg divide-y max-h-48 overflow-y-auto">
            {scannedProjects.map(p => (
              <button
                key={p.path}
                className={cn(
                  'w-full flex items-center gap-3 px-3 py-2 text-left transition-colors',
                  selectedPaths.has(p.path) ? 'bg-primary/10' : 'hover:bg-accent/50'
                )}
                onClick={() => toggleSelect(p.path)}
              >
                <div className={cn(
                  'h-4 w-4 rounded border flex items-center justify-center shrink-0',
                  selectedPaths.has(p.path) ? 'bg-primary border-primary' : 'border-input'
                )}>
                  {selectedPaths.has(p.path) && <CheckCircle2 className="h-3 w-3 text-primary-foreground" />}
                </div>
                <div className="flex-1 min-w-0">
                  <span className="text-sm font-medium">{p.name}</span>
                  <p className="text-[11px] text-muted-foreground truncate">{p.path}</p>
                </div>
                {p.techStack.slice(0, 2).map(t => (
                  <Badge key={t} variant="outline" className="text-[10px] px-1.5 py-0">{t}</Badge>
                ))}
              </button>
            ))}
          </div>
        </div>
      )}

      <FolderBrowser
        open={scanBrowserOpen}
        onOpenChange={setScanBrowserOpen}
        onSelect={onScan}
        title="Select folder to scan for projects"
      />

      <FolderBrowser
        open={addBrowserOpen}
        onOpenChange={setAddBrowserOpen}
        onSelectMultiple={onAddFolder}
        multiSelect
        title="Select project folders to add"
      />
    </div>
  )
}

function StepFeatures() {
  return (
    <div className="flex-1 space-y-5">
      <div>
        <h2 className="text-xl font-bold mb-1">What You Can Do</h2>
        <p className="text-sm text-muted-foreground">
          Shipyard brings everything together so you don't need to leave your dashboard.
        </p>
      </div>

      <div className="space-y-2.5">
        <InfoCard
          icon={<ClipboardList className="h-5 w-5" />}
          title="Kanban Board"
          description="Organize tasks in Inbox, In Progress, and Done. Drag-and-drop between columns. View all tasks across projects in one board."
        />
        <InfoCard
          icon={<Terminal className="h-5 w-5" />}
          title="Integrated Terminal"
          description="Run shells, dev servers, and your AI assistant directly inside the dashboard. Multiple tabs, resizable panel. Ctrl+` to toggle."
        />
        <InfoCard
          icon={<GitBranch className="h-5 w-5" />}
          title="Git Panel"
          description="Stage, commit, push, and pull without leaving the browser. See diffs, file changes, and commit history at a glance."
        />
        <InfoCard
          icon={<Cloud className="h-5 w-5" />}
          title="Sync & Export"
          description="Sync tasks with Google Sheets. Export as JSON or Markdown. Import/export backups in Settings."
        />
      </div>

      <div className="p-3 rounded-lg bg-muted/50 text-xs text-muted-foreground">
        All data is stored locally as JSON files. No cloud, no accounts, no tracking.
      </div>
    </div>
  )
}

function InfoCard({ icon, title, description }: { icon: React.ReactNode; title: string; description: string }) {
  return (
    <div className="flex gap-3 p-3 rounded-lg border bg-card">
      <span className="text-primary shrink-0 mt-0.5">{icon}</span>
      <div>
        <h3 className="text-sm font-medium mb-0.5">{title}</h3>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
    </div>
  )
}

function StepReady() {
  return (
    <div className="flex-1 flex flex-col items-center justify-center text-center space-y-6">
      <div className="w-16 h-16 rounded-full bg-green-500/10 flex items-center justify-center">
        <CheckCircle2 className="h-8 w-8 text-green-500" />
      </div>

      <div>
        <h2 className="text-xl font-bold mb-2">You're All Set!</h2>
        <p className="text-muted-foreground text-sm max-w-md">
          Your dashboard is ready. Here's a quick reference:
        </p>
      </div>

      <div className="w-full max-w-sm space-y-2 text-left">
        <Tip label="Click any project" description="to open it as a tab with kanban, git, and terminals" />
        <Tip label="Drag tasks" description="between Inbox, In Progress, and Done columns" />
        <Tip label="Ctrl + `" description="to toggle the integrated terminal panel" />
        <Tip label="Quick Launch buttons" description="open AI assistant, dev server, or shell for any project" />
        <Tip label="Git indicators" description="in the sidebar show uncommitted, unpushed, and to-pull counts" />
        <Tip label="Help page" description="has a full manual — find it in Settings or sidebar" />
      </div>
    </div>
  )
}

function Tip({ label, description }: { label: string; description: string }) {
  return (
    <div className="flex gap-2 text-sm">
      <span className="text-primary shrink-0">•</span>
      <p><strong>{label}</strong> <span className="text-muted-foreground">— {description}</span></p>
    </div>
  )
}
