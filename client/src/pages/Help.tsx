import { useState } from 'react'
import { Header } from '@/components/layout/Header'
import {
  LayoutDashboard, ClipboardList, GitBranch, Terminal, Settings, FolderOpen,
  Star, ArrowUp, ArrowDown, FileEdit, Cloud, Download, Keyboard, ChevronDown,
  Layers, Search, ExternalLink, GripVertical, Copy, Plus, Trash2, RefreshCw,
  MonitorPlay, HelpCircle
} from 'lucide-react'
import { cn } from '@/lib/utils'

type SectionId = 'overview' | 'dashboard' | 'workspace' | 'tasks' | 'terminal' | 'git' | 'sync' | 'settings' | 'shortcuts' | 'data' | 'electron'

const sections: { id: SectionId; label: string; icon: React.ReactNode }[] = [
  { id: 'overview', label: 'Overview', icon: <HelpCircle className="h-4 w-4" /> },
  { id: 'dashboard', label: 'Dashboard', icon: <LayoutDashboard className="h-4 w-4" /> },
  { id: 'workspace', label: 'Workspace', icon: <Layers className="h-4 w-4" /> },
  { id: 'tasks', label: 'Tasks & Kanban', icon: <ClipboardList className="h-4 w-4" /> },
  { id: 'terminal', label: 'Terminal', icon: <Terminal className="h-4 w-4" /> },
  { id: 'git', label: 'Git', icon: <GitBranch className="h-4 w-4" /> },
  { id: 'sync', label: 'Sync & Export', icon: <Cloud className="h-4 w-4" /> },
  { id: 'settings', label: 'Settings', icon: <Settings className="h-4 w-4" /> },
  { id: 'shortcuts', label: 'Shortcuts', icon: <Keyboard className="h-4 w-4" /> },
  { id: 'data', label: 'Data & Storage', icon: <Download className="h-4 w-4" /> },
  { id: 'electron', label: 'Desktop App', icon: <MonitorPlay className="h-4 w-4" /> },
]

export function Help() {
  const [active, setActive] = useState<SectionId>('overview')

  return (
    <>
      <Header title="Help" />
      <div className="flex-1 overflow-hidden flex">
        {/* Nav sidebar */}
        <nav className="w-52 shrink-0 border-r overflow-y-auto p-3 space-y-0.5 scrollbar-dark">
          {sections.map(s => (
            <button
              key={s.id}
              onClick={() => setActive(s.id)}
              className={cn(
                'w-full flex items-center gap-2.5 px-3 py-2 rounded-md text-sm transition-colors text-left',
                active === s.id
                  ? 'bg-primary/10 text-primary font-medium'
                  : 'text-muted-foreground hover:bg-accent hover:text-foreground'
              )}
            >
              {s.icon}
              {s.label}
            </button>
          ))}
        </nav>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 scrollbar-dark">
          <div className="max-w-3xl space-y-6">
            {active === 'overview' && <SectionOverview />}
            {active === 'dashboard' && <SectionDashboard />}
            {active === 'workspace' && <SectionWorkspace />}
            {active === 'tasks' && <SectionTasks />}
            {active === 'terminal' && <SectionTerminal />}
            {active === 'git' && <SectionGit />}
            {active === 'sync' && <SectionSync />}
            {active === 'settings' && <SectionSettings />}
            {active === 'shortcuts' && <SectionShortcuts />}
            {active === 'data' && <SectionData />}
            {active === 'electron' && <SectionElectron />}
          </div>
        </div>
      </div>
    </>
  )
}

// ── Helpers ──────────────────────────────────────────────────────────

function H2({ children }: { children: React.ReactNode }) {
  return <h2 className="text-lg font-bold mb-3">{children}</h2>
}

function H3({ children }: { children: React.ReactNode }) {
  return <h3 className="text-sm font-semibold mt-5 mb-2">{children}</h3>
}

function P({ children }: { children: React.ReactNode }) {
  return <p className="text-sm text-muted-foreground leading-relaxed mb-3">{children}</p>
}

function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="px-1.5 py-0.5 text-[11px] font-mono bg-muted border rounded-md">{children}</kbd>
  )
}

function Bullet({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-2 text-sm mb-2">
      <span className="text-primary shrink-0 mt-0.5">•</span>
      <p><strong>{title}</strong> <span className="text-muted-foreground">— {children}</span></p>
    </div>
  )
}

function InfoBox({ children }: { children: React.ReactNode }) {
  return (
    <div className="p-3 rounded-lg bg-muted/50 border text-xs text-muted-foreground space-y-1">
      {children}
    </div>
  )
}

function ShortcutRow({ keys, description }: { keys: string; description: string }) {
  return (
    <div className="flex items-center justify-between py-2 border-b border-border/50 last:border-0">
      <span className="text-sm text-muted-foreground">{description}</span>
      <Kbd>{keys}</Kbd>
    </div>
  )
}

// ── Sections ────────────────────────────────────────────────────────

function SectionOverview() {
  return (
    <>
      <H2>Shipyard — Local Development Dashboard</H2>
      <P>
        Shipyard is a local dashboard for developers who manage multiple projects. It centralizes
        task management, git operations, terminal launchers, and project navigation in a single
        browser-based interface.
      </P>
      <P>
        It runs entirely on your machine. All data is stored as JSON files — no cloud services,
        no accounts, no tracking. It complements your editor (VS Code, etc.), it doesn't replace it.
      </P>

      <H3>Key Features</H3>
      <Bullet title="Multi-project tabs">Open several projects simultaneously and switch instantly between them.</Bullet>
      <Bullet title="Kanban board">Organize tasks in Inbox, In Progress, and Done with drag-and-drop.</Bullet>
      <Bullet title="Integrated terminal">Run shells, dev servers, and Claude Code inside the dashboard.</Bullet>
      <Bullet title="Git panel">Stage, commit, push, pull, and view diffs without leaving the browser.</Bullet>
      <Bullet title="Google Sheets sync">Bidirectional sync of tasks via Google Apps Script.</Bullet>
      <Bullet title="Export/Import">JSON and Markdown export. Full backup/restore in Settings.</Bullet>
      <Bullet title="Desktop app">Available as an installable app via Electron (Windows, macOS, Linux).</Bullet>

      <H3>Architecture</H3>
      <InfoBox>
        <p><strong>Frontend:</strong> React + Vite + Tailwind CSS + shadcn/ui (port 5421 in dev)</p>
        <p><strong>Backend:</strong> Fastify + TypeScript (port 5420 in dev)</p>
        <p><strong>Data:</strong> JSON files in <code className="bg-muted px-1 rounded">data/</code></p>
        <p><strong>Desktop:</strong> Electron wrapper (port 5430 in production)</p>
      </InfoBox>
    </>
  )
}

function SectionDashboard() {
  return (
    <>
      <H2>Dashboard (Home)</H2>
      <P>
        The dashboard is the landing page. It shows all your projects and highlights active work.
      </P>

      <H3>Working On Banner</H3>
      <P>
        At the top, a horizontal strip shows tasks currently in progress across all projects.
        Click any task to jump directly to its project workspace.
      </P>

      <H3>Project Grid</H3>
      <P>
        All added projects appear as cards in a grid. Each card shows:
      </P>
      <Bullet title="Tech stack badges">Detected from package.json (React, Vite, Tailwind, etc.).</Bullet>
      <Bullet title="Git branch">Current branch and dirty indicator (asterisk).</Bullet>
      <Bullet title="Task counts">How many tasks are in inbox, in progress, and done.</Bullet>
      <Bullet title="Quick actions">Hover to see launch buttons for terminal, VS Code, folder.</Bullet>

      <H3>Search</H3>
      <P>
        The search bar at the top filters projects by name. Results update as you type.
        Projects can also be searched from the sidebar.
      </P>

      <H3>Sorting & Filters</H3>
      <P>
        Sort by name, recent activity, or task count. Filter by category (parent folder name).
        Favorites appear first when sorting by recent.
      </P>
    </>
  )
}

function SectionWorkspace() {
  return (
    <>
      <H2>Project Workspace</H2>
      <P>
        Click any project to open it as a tab. Each workspace has three areas:
      </P>

      <H3>Main Area (left, 3/4 width)</H3>
      <Bullet title="Info bar">Project path, git branch badge, favorite star, external link.</Bullet>
      <Bullet title="Kanban board">Three columns: Inbox, In Progress, Done. Drag tasks between them.</Bullet>

      <H3>Sidebar (right, 1/4 width)</H3>
      <Bullet title="Quick Launch">Buttons to open Claude Code, Dev Server, Shell, VS Code, and Folder.</Bullet>
      <Bullet title="Claude context">Copy project context (path, tasks) to clipboard for Claude Code.</Bullet>
      <Bullet title="Git panel">Full git operations (details in Git section).</Bullet>

      <H3>Terminal Panel (bottom)</H3>
      <P>
        A resizable panel at the bottom with integrated terminal tabs. Toggle with <Kbd>Ctrl + `</Kbd>.
        More details in the Terminal section.
      </P>

      <H3>Multi-tab Navigation</H3>
      <P>
        The tab bar at the top shows all open projects. Home tab is always present. Click a project
        anywhere (sidebar, dashboard, task badge) to open it as a new tab. Close tabs with the X button.
        Switching between tabs is instant thanks to cached data.
      </P>

      <H3>External Links</H3>
      <P>
        Each project can have an external link (Notion, Google Sheets, Figma, etc.).
        Click the link icon in the info bar to add or edit it. Links open in the default browser.
      </P>
    </>
  )
}

function SectionTasks() {
  return (
    <>
      <H2>Tasks & Kanban</H2>

      <H3>Kanban Board</H3>
      <P>
        Each project has a 3-column kanban board: <strong>Inbox</strong> (backlog/todo),{' '}
        <strong>In Progress</strong>, and <strong>Done</strong>. Drag tasks between columns
        to change their status. Tasks are ordered within each column — drag to reorder.
      </P>

      <H3>Creating Tasks</H3>
      <P>
        Click the <strong>+</strong> button at the top of any column. Fill in:
      </P>
      <Bullet title="Title">Short description of the task.</Bullet>
      <Bullet title="Description">What needs to be done (user-facing, plain language).</Bullet>
      <Bullet title="Prompt">Technical details, causes, files, solutions. This is copied along with context for Claude.</Bullet>
      <Bullet title="Priority">Urgent, High, Medium, or Low. Affects visual indicators.</Bullet>

      <H3>Task Actions</H3>
      <Bullet title="Edit">Click the task card to open the editor dialog.</Bullet>
      <Bullet title="Copy as prompt">Copies task title, description, and prompt to clipboard for AI tools.</Bullet>
      <Bullet title="Delete">Remove the task permanently.</Bullet>
      <Bullet title="Toggle status">Click the status icon on the card to cycle through states.</Bullet>

      <H3>All Tasks View</H3>
      <P>
        Navigate to <strong>All Tasks</strong> in the sidebar to see every task across all projects
        in a single kanban board. Tasks show project name badges. You can filter by search text and priority.
      </P>

      <H3>Timestamps</H3>
      <P>
        Tasks track when they entered each stage: <code>inboxAt</code>, <code>inProgressAt</code>,{' '}
        <code>doneAt</code>. These cascade — moving to Done also fills in the earlier timestamps if missing.
      </P>
    </>
  )
}

function SectionTerminal() {
  return (
    <>
      <H2>Integrated Terminal</H2>
      <P>
        Shipyard includes a full terminal emulator inside the browser, powered by xterm.js and node-pty.
        It supports colors, interactive programs, and all the features of a real terminal.
      </P>

      <H3>Terminal Panel</H3>
      <P>
        The terminal panel sits at the bottom of the workspace. Toggle it with <Kbd>Ctrl + `</Kbd> or
        the terminal button. Resize it by dragging the top edge. The height is saved between sessions.
      </P>

      <H3>Terminal Tabs</H3>
      <P>
        Each tab is an independent terminal session. Click <strong>+</strong> to open a new shell.
        The Quick Launch buttons create named tabs:
      </P>
      <Bullet title="Shell">Opens a shell in the project directory (PowerShell on Windows, bash/zsh on Linux/macOS).</Bullet>
      <Bullet title="Dev">Runs <code>pnpm dev</code> (or npm/yarn) in the project directory.</Bullet>
      <Bullet title="Claude">Opens Claude Code (<code>claude</code> command) in the project directory.</Bullet>
      <Bullet title="Claude YOLO">Opens Claude Code with auto-accept (<code>claude --dangerously-skip-permissions</code>).</Bullet>

      <H3>Native Terminal Fallback</H3>
      <P>
        If node-pty is not available (build tools missing), the Quick Launch buttons
        fall back to opening native OS terminals (Windows Terminal, gnome-terminal, Terminal.app).
        A "Open Native Terminal" button is also available when the integrated terminal is active.
      </P>

      <H3>Session Persistence</H3>
      <P>
        Terminal sessions stay alive when you switch between project tabs. The PTY process
        runs on the server — navigating away and back reconnects to the same session.
        Closing a tab kills the PTY process.
      </P>

      <InfoBox>
        <p><strong>Requirement:</strong> node-pty (optional dependency). Installed automatically on most systems.</p>
        <p><strong>Shell:</strong> PowerShell (Windows), $SHELL or /bin/bash (Linux/macOS)</p>
        <p><strong>Fonts:</strong> Cascadia Code, Fira Code, JetBrains Mono, Consolas (fallback)</p>
      </InfoBox>
    </>
  )
}

function SectionGit() {
  return (
    <>
      <H2>Git Panel</H2>
      <P>
        The git panel in the workspace sidebar provides a complete git workflow without
        leaving the dashboard.
      </P>

      <H3>File Changes</H3>
      <P>
        Files are grouped into three sections:
      </P>
      <Bullet title="Staged">Files ready to commit. Click to unstage. Expand to see diff.</Bullet>
      <Bullet title="Unstaged">Modified files not yet staged. Click to stage.</Bullet>
      <Bullet title="Untracked">New files. Click to stage.</Bullet>
      <P>
        Use "Stage All" and "Unstage All" buttons for bulk operations.
      </P>

      <H3>Commit</H3>
      <P>
        Type a commit message and click Commit. The message input clears after a successful commit.
        Only staged files are included in the commit.
      </P>

      <H3>Push & Pull</H3>
      <P>
        Push commits to remote or pull latest changes. The panel shows ahead/behind counts
        relative to the remote tracking branch.
      </P>

      <H3>Commit Log</H3>
      <P>
        A collapsible section shows recent commits with hash, message, author, and date.
      </P>

      <H3>Sidebar Indicators</H3>
      <P>
        The navigation sidebar shows git status indicators next to each project:
      </P>
      <div className="flex flex-col gap-2 pl-4 my-3">
        <div className="flex items-center gap-2 text-sm">
          <ArrowUp className="h-3.5 w-3.5 text-orange-400" />
          <span className="text-muted-foreground">Orange — unpushed commits (ahead of remote)</span>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <ArrowDown className="h-3.5 w-3.5 text-blue-400" />
          <span className="text-muted-foreground">Blue — commits to pull (behind remote)</span>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <FileEdit className="h-3.5 w-3.5 text-yellow-400" />
          <span className="text-muted-foreground">Yellow — uncommitted changes (staged + unstaged + untracked)</span>
        </div>
      </div>
      <P>
        Indicators refresh automatically every 15 seconds.
      </P>
    </>
  )
}

function SectionSync() {
  return (
    <>
      <H2>Sync & Export</H2>

      <H3>Google Sheets Sync</H3>
      <P>
        Sync tasks bidirectionally with a Google Sheets spreadsheet via Google Apps Script.
        No Google API keys needed — you deploy a small script to your Sheet and paste the URL.
      </P>
      <Bullet title="Setup">Open the Sheets badge on any project's kanban header. Follow the step-by-step guide to deploy the Apps Script.</Bullet>
      <Bullet title="Auto-push">Every task change is automatically pushed to the sheet (2s debounce).</Bullet>
      <Bullet title="Auto-pull">Tasks are pulled from the sheet every 30 seconds and merged silently.</Bullet>
      <Bullet title="Merge">Per-task merge by updatedAt — the most recent version wins. New tasks from both sides are preserved.</Bullet>
      <Bullet title="Manual push/pull">Buttons in the kanban header for immediate sync.</Bullet>

      <InfoBox>
        <p><strong>Config location:</strong> localStorage only — nothing saved on the server. Portable via URL.</p>
        <p><strong>Columns synced:</strong> id, title, description, priority, status, prompt, updatedAt</p>
      </InfoBox>

      <H3>JSON Export</H3>
      <P>
        Export all tasks of a project as a JSON file. Includes timestamps and metadata.
        Available from the toolbar buttons on the kanban board.
      </P>

      <H3>Markdown Export</H3>
      <P>
        Export tasks as formatted Markdown — choose between checklist, table, or detailed formats.
        Copy to clipboard or download as a file.
      </P>

      <H3>Full Backup (Settings)</H3>
      <P>
        In Settings, export/import a complete backup including projects, settings, and all tasks.
        Useful for migrating to another machine or creating snapshots.
      </P>
    </>
  )
}

function SectionSettings() {
  return (
    <>
      <H2>Settings</H2>

      <H3>Adding Projects</H3>
      <P>
        Shipyard doesn't auto-scan your filesystem. You manually select which projects to track:
      </P>
      <Bullet title="Scan a folder">Select a parent directory and Shipyard finds all projects inside it (up to 3 levels deep).</Bullet>
      <Bullet title="Add folder">Select a specific project folder directly.</Bullet>
      <P>
        Projects are detected by markers: package.json, .git, Cargo.toml, go.mod, requirements.txt, pyproject.toml, CLAUDE.md.
      </P>

      <H3>Managing Projects</H3>
      <Bullet title="Remove">Remove a project from the dashboard (doesn't delete files).</Bullet>
      <Bullet title="Rename">Edit the display name by clicking it in the project card or workspace.</Bullet>
      <Bullet title="Favorite">Star projects to pin them in the sidebar favorites section.</Bullet>

      <H3>Integrations</H3>
      <P>
        The Integrations card shows available sync providers and their status per project.
        Currently available: Google Sheets, JSON Export, Markdown Export.
      </P>

      <H3>Export & Import</H3>
      <Bullet title="Export">Download a JSON backup of settings, projects, and tasks.</Bullet>
      <Bullet title="Import">Load a backup file to merge with existing data. Duplicates are skipped.</Bullet>
    </>
  )
}

function SectionShortcuts() {
  return (
    <>
      <H2>Keyboard Shortcuts</H2>

      <H3>Terminal</H3>
      <div className="border rounded-lg p-3">
        <ShortcutRow keys="Ctrl + `" description="Toggle terminal panel" />
      </div>

      <H3>Navigation</H3>
      <P>
        Click projects in the sidebar or dashboard to open them as tabs. Close tabs with the X button
        or by clicking the active tab's close button.
      </P>

      <H3>Task Board</H3>
      <P>
        Drag-and-drop tasks between columns. Click a task to edit. The kanban board supports
        pointer-based drag with an 8px activation distance to prevent accidental drags.
      </P>
    </>
  )
}

function SectionData() {
  return (
    <>
      <H2>Data & Storage</H2>

      <H3>File Locations</H3>
      <InfoBox>
        <p><strong>Dev mode:</strong> <code className="bg-muted px-1 rounded">./data/</code> inside the project folder</p>
        <p><strong>Desktop app:</strong> <code className="bg-muted px-1 rounded">%APPDATA%/shipyard/data/</code> (Windows) or <code className="bg-muted px-1 rounded">~/Library/Application Support/shipyard/data/</code> (macOS)</p>
      </InfoBox>

      <H3>File Structure</H3>
      <div className="font-mono text-xs bg-muted/50 border rounded-lg p-4 space-y-1">
        <p>data/</p>
        <p className="pl-4">settings.json <span className="text-muted-foreground">— selected project paths</span></p>
        <p className="pl-4">projects.json <span className="text-muted-foreground">— cache (auto-generated)</span></p>
        <p className="pl-4">tasks/</p>
        <p className="pl-8">project-id.json <span className="text-muted-foreground">— tasks for each project</span></p>
      </div>

      <H3>Portability</H3>
      <P>
        Since all data is JSON files, you can:
      </P>
      <Bullet title="Sync across machines">Put the data folder in Dropbox, Google Drive, or OneDrive.</Bullet>
      <Bullet title="Version control">Track the data folder in a private git repo.</Bullet>
      <Bullet title="Backup/restore">Use the export/import feature in Settings.</Bullet>

      <H3>Privacy</H3>
      <P>
        Shipyard never sends data to external servers. The only network calls are:
      </P>
      <Bullet title="Google Sheets sync">Only if you configure it. Goes through your own Apps Script URL.</Bullet>
      <Bullet title="Git operations">Push/pull go to your configured git remotes.</Bullet>
      <P>
        Everything else runs 100% locally.
      </P>
    </>
  )
}

function SectionElectron() {
  return (
    <>
      <H2>Desktop App (Electron)</H2>
      <P>
        Shipyard can run as a standalone desktop application. The Electron wrapper packages
        the server and client into a single installable app.
      </P>

      <H3>Installation</H3>
      <P>
        Run the installer for your platform (e.g., <code>Shipyard-Setup-1.0.0.exe</code> on Windows).
        The app installs to the default location and creates Start Menu/Desktop shortcuts.
      </P>

      <H3>How It Works</H3>
      <Bullet title="Server">The Fastify server runs as a background process inside the app.</Bullet>
      <Bullet title="Client">The frontend is served as static files by the server.</Bullet>
      <Bullet title="Data">Stored in your OS app data directory (separate from dev mode).</Bullet>
      <Bullet title="Port">Uses port 5430 in production (5420 in dev) to avoid conflicts.</Bullet>

      <H3>System Tray</H3>
      <P>
        Closing the window minimizes to the system tray. Double-click the tray icon to restore.
        Right-click for options: Show, Quit. Only one instance can run at a time.
      </P>

      <H3>Building from Source</H3>
      <InfoBox>
        <p><code className="bg-muted px-1 rounded">pnpm dist:win</code> — Build Windows installer (.exe)</p>
        <p><code className="bg-muted px-1 rounded">pnpm dist:mac</code> — Build macOS disk image (.dmg)</p>
        <p><code className="bg-muted px-1 rounded">pnpm dist:linux</code> — Build Linux packages (.AppImage, .deb)</p>
      </InfoBox>

      <H3>Dev vs Desktop</H3>
      <P>
        You can use both modes simultaneously. The dev server (port 5420) and the desktop app
        (port 5430) run independently with separate data directories. The dev version uses
        <code> ./data/</code> while the desktop app uses the OS app data folder.
      </P>
    </>
  )
}
