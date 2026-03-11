<p align="center">
  <img src="client/public/favicon.svg" width="64" height="64" alt="DevDash" />
</p>

<h1 align="center">DevDash</h1>

<p align="center">
  Local development dashboard for managing projects, tasks, git, and terminals.<br/>
  Runs on <code>localhost</code> — no cloud, no accounts, your data stays on your machine.
</p>

<p align="center">
  <img src="https://img.shields.io/badge/react-18-blue?style=flat-square" alt="React 18" />
  <img src="https://img.shields.io/badge/fastify-5-green?style=flat-square" alt="Fastify 5" />
  <img src="https://img.shields.io/badge/typescript-5-blue?style=flat-square" alt="TypeScript" />
  <img src="https://img.shields.io/badge/license-MIT-gray?style=flat-square" alt="MIT" />
</p>

---

## What it does

- **Project overview** — see all your projects with git status, branch, tech stack, and task counts
- **Kanban board** — per-project task management with drag-and-drop (Inbox / In Progress / Done)
- **Git panel** — stage, commit, push, pull, view diffs — all from the browser
- **Terminal launchers** — open Claude Code, dev server, shell, VS Code, or file manager with one click
- **Claude integration** — copies project context + tasks to clipboard, then opens Claude Code ready to paste
- **Google Sheets sync** — sync tasks with a Google Sheet via Apps Script (no API keys needed)
- **Export/Import** — JSON for backups, CSV for sharing with clients or teams

## Quick Start

### Prerequisites

- [Node.js](https://nodejs.org) >= 18
- [pnpm](https://pnpm.io) (`npm install -g pnpm`)
- [git](https://git-scm.com)

### Install

```bash
git clone https://github.com/your-username/devdash.git
cd devdash
```

**Automated setup** (installs dependencies + optional shortcuts):

| OS | Command |
|----|---------|
| Linux / macOS | `chmod +x setup.sh && ./setup.sh` |
| Windows | `setup.cmd` |

**Manual setup:**

```bash
pnpm install
pnpm dev
```

Open [http://localhost:5421](http://localhost:5421) — a setup wizard will guide you through adding your first projects.

### Launch shortcuts

| OS | Command | What it does |
|----|---------|-------------|
| Any | `pnpm dev` | Starts client (5421) + server (5420) |
| Linux / macOS | `./devdash.sh` | Starts server + opens browser |
| Windows | `devdash.cmd` | Starts server + opens browser |
| Linux | Search "DevDash" in app launcher | If desktop shortcut was created during setup |

**Create a shell alias** (Linux/macOS):

```bash
# Add to ~/.bashrc or ~/.zshrc:
alias devdash='cd /path/to/devdash && ./devdash.sh'
```

## First Run

On first access, DevDash shows a setup wizard that walks you through:

1. **Adding projects** — scan a folder to discover projects, or add individual folders
2. **Understanding data storage** — all data is local JSON files, with export/import options
3. **Quick reference** — how the dashboard works

You can always add/remove projects later in **Settings**.

## How It Works

### Dashboard

The home screen shows all your projects with live git status. Click any project to open it as a tab.

- **Working On** banner shows your in-progress tasks across all projects
- Each project card shows: branch, uncommitted changes, tech stack, and task counts
- Quick-launch buttons on each card: Claude Code, dev server, shell, VS Code, file manager

### Project Workspace

Opens in tabs — work on multiple projects simultaneously.

- **Left (3/4)**: Kanban board with drag-and-drop
- **Right (1/4)**: Claude context tools + Quick Launch + Git panel

### Buttons & Actions

Every action button has a tooltip explaining what it does. Hover to learn more. Key actions:

| Button | What it does |
|--------|-------------|
| **Open Claude + Copy Context** | Copies project info + task list to clipboard, opens Claude Code terminal — just paste |
| **Copy Tasks Context** | Copies all tasks as text to clipboard for pasting into any AI tool |
| **Copy In Progress** | Copies only in-progress tasks as a focused prompt |
| **Export JSON** | Downloads tasks as JSON file (for backup or transferring between machines) |
| **Import JSON** | Loads tasks from a JSON file |
| **Export CSV** | Downloads tasks as spreadsheet (for sharing with clients) |
| **Import CSV** | Imports CSV with a diff review dialog to merge changes safely |
| **Sheets** | Connect to a Google Sheet — push/pull tasks between DevDash and the spreadsheet |
| **Copy as prompt** (on task) | Copies a single task as an AI-ready prompt |

## Data & Sync

### Where data lives

```
devdash/data/
├── settings.json              # Your selected project paths
├── projects.json              # Cached project metadata
└── tasks/
    └── <project-id>.json      # Tasks for each project
```

All data is local. No database, no cloud services.

### Moving to another machine

**Option 1: Export/Import** (simplest)
- Export tasks as JSON from each project
- Copy the JSON files to the new machine
- Import them in DevDash on the new machine

**Option 2: Sync the data folder** (automatic)
- Move `data/` to a synced location (Dropbox, Google Drive, OneDrive, iCloud)
- Create a symlink from `devdash/data` to the synced folder:

```bash
# Linux / macOS
ln -s ~/Dropbox/devdash-data ./data

# Windows (run as admin)
mklink /D data "C:\Users\you\Dropbox\devdash-data"
```

**Option 3: Private Git repo** (versioned)
- Initialize `data/` as its own git repo
- Push to a private GitHub/GitLab repo
- Pull on other machines

```bash
cd data
git init
git remote add origin https://github.com/you/devdash-data.git
git add -A && git commit -m "sync" && git push
```

> **Recommendation:** For solo use, Google Sheets sync (Option 4) is the easiest per-project solution. For syncing everything at once, cloud folder sync (Option 2) works well.

**Option 4: Google Sheets sync** (per-project, collaborative)

Sync a project's tasks with a Google Sheet — anyone with the sheet URL can pull tasks into their own DevDash.

#### Setup

1. Create a Google Sheet (any name)
2. Open **Extensions > Apps Script**
3. Delete the default code, paste the script below:

```javascript
const HEADERS = ['id', 'title', 'description', 'priority', 'status', 'prompt', 'updatedAt'];

function doGet(e) {
  const action = (e && e.parameter && e.parameter.action) || 'read';
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();

  if (action === 'ping') {
    return jsonResp({ ok: true, rows: Math.max(0, sheet.getLastRow() - 1) });
  }

  const data = sheet.getDataRange().getValues();
  if (data.length < 2) return jsonResp({ tasks: [] });

  var headers = data[0].map(function(h) { return String(h).toLowerCase().trim(); });
  var tasks = [];
  for (var i = 1; i < data.length; i++) {
    var row = data[i];
    if (!row.some(function(c) { return String(c).trim(); })) continue;
    var task = {};
    headers.forEach(function(h, idx) { task[h] = String(row[idx] || ''); });
    if (task.title) tasks.push(task);
  }
  return jsonResp({ tasks: tasks });
}

function doPost(e) {
  try {
    var payload = JSON.parse(e.postData.contents);
    var tasks = payload.tasks || [];
    var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
    sheet.clear();
    sheet.appendRow(HEADERS);
    for (var i = 0; i < tasks.length; i++) {
      var t = tasks[i];
      sheet.appendRow(HEADERS.map(function(h) { return t[h] || ''; }));
    }
    if (HEADERS.length > 0) sheet.autoResizeColumns(1, HEADERS.length);
    return jsonResp({ success: true, updated: tasks.length });
  } catch (err) {
    return jsonResp({ error: err.message });
  }
}

function jsonResp(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

// Auto-update updatedAt when editing cells manually
function onEdit(e) {
  var sheet = e.source.getActiveSheet();
  var row = e.range.getRow();
  if (row < 2) return;
  var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  var col = headers.indexOf('updatedAt');
  if (col === -1) return;
  if (e.range.getColumn() === col + 1) return;
  sheet.getRange(row, col + 1).setValue(new Date().toISOString());
}
```

4. Click **Deploy > New deployment > Web App**
5. Set **Execute as:** Me, **Access:** Anyone
6. Copy the deployment URL
7. In DevDash, open a project and click the **Sheets** button in the task board header
8. Paste the URL, click **Test**, then **Save**

#### How it works

- **Auto-sync**: every task change in DevDash auto-pushes to the sheet (2s debounce). Every 30s, DevDash polls the sheet and merges changes.
- **Merge (not overwrite)**: sync uses per-task `updatedAt` timestamps. The newest version of each task wins. New tasks from either side are preserved. No data is lost.
- **Push** button: manually merges local → sheet
- **Pull** button: manually replaces local with sheet data
- Config is stored **only in your browser** (localStorage) — not on the server
- The backend acts as a stateless proxy: it receives the Apps Script URL in each request, fetches it, and returns the result

#### Multi-machine workflow

1. Machine A: configure the sheet URL, push tasks
2. Machine B: install DevDash, add the same project, configure the same sheet URL, pull tasks
3. Both machines now have the same tasks — push/pull to stay in sync

> The Google Sheet becomes the shared source of truth. Each person configures the URL in their own browser.

## Terminal Launchers

DevDash opens native terminals on your OS:

| Action | Linux | macOS | Windows |
|--------|-------|-------|---------|
| Terminal | gnome-terminal | Terminal.app | Windows Terminal |
| VS Code | `code` | `code` | `code` |
| File manager | xdg-open | open | explorer.exe |

On Linux, terminal tabs stay open after the command runs. On Windows, it uses `cmd.exe` (not bash, to avoid triggering WSL).

## Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18 + Vite + TypeScript + Tailwind CSS + shadcn/ui |
| Backend | Fastify 5 + TypeScript (tsx) |
| Data | JSON files in `data/` (no database) |
| Monorepo | pnpm workspaces |

## Project Structure

```
devdash/
├── client/                  # Frontend (port 5421)
│   ├── src/
│   │   ├── components/      # UI components (shadcn/ui based)
│   │   ├── hooks/           # React Query hooks
│   │   ├── lib/             # API client, utilities
│   │   └── pages/           # Dashboard, Workspace, Tasks, Settings
│   └── public/              # Favicon, manifest
├── server/                  # Backend API (port 5420)
│   └── src/
│       ├── routes/          # REST endpoints
│       └── services/        # Git, tasks, terminals, settings
├── data/                    # Local data (auto-created, gitignored)
├── setup.sh                 # Linux/macOS setup script
├── setup.cmd                # Windows setup script
├── devdash.sh               # Linux/macOS launcher
└── devdash.cmd              # Windows launcher
```

## Contributing

1. Fork the repo
2. Create a feature branch
3. Make your changes
4. Run `pnpm dev` and test manually
5. Submit a PR

The project uses `CLAUDE.md` as internal documentation — update it when adding routes, components, or changing architecture.

## License

MIT
