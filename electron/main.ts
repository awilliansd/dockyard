import { app, BrowserWindow, Tray, Menu, nativeImage, shell, dialog } from 'electron';
import { join, resolve } from 'path';
import { existsSync, mkdirSync } from 'fs';
import { spawn, type ChildProcess } from 'child_process';

// ── Paths ──────────────────────────────────────────────────────────

const isDev = !app.isPackaged;

const ROOT_DIR = isDev
  ? resolve(__dirname, '..')
  : resolve(process.resourcesPath);

const CLIENT_DIST = isDev
  ? resolve(ROOT_DIR, 'client', 'dist')
  : resolve(process.resourcesPath, 'app', 'client', 'dist');

const SERVER_ENTRY = isDev
  ? resolve(ROOT_DIR, 'server', 'src', 'index.ts')
  : resolve(process.resourcesPath, 'app', 'server', 'dist', 'index.js');

const ICON_PATH = isDev
  ? resolve(ROOT_DIR, 'assets', 'icon.png')
  : resolve(process.resourcesPath, 'icon.png');

// Data directory: use AppData in production, project root in dev
const DATA_DIR = isDev
  ? resolve(ROOT_DIR, 'data')
  : resolve(app.getPath('userData'), 'data');

// Ensure data directory exists
mkdirSync(DATA_DIR, { recursive: true });
mkdirSync(join(DATA_DIR, 'tasks'), { recursive: true });

// ── Server process ─────────────────────────────────────────────────

// Use different port than dev server (5420) to avoid conflicts
const PORT = isDev ? 5420 : 5430;
let serverProcess: ChildProcess | null = null;

function startServer(): Promise<void> {
  return new Promise((res, reject) => {
    const env: Record<string, string> = {
      ...process.env as Record<string, string>,
      SHIPYARD_ELECTRON: '1',
      SHIPYARD_DATA_DIR: DATA_DIR,
      SHIPYARD_STATIC_DIR: CLIENT_DIST,
      SHIPYARD_PORT: String(PORT),
      SHIPYARD_HOST: '127.0.0.1',
    };

    console.log('[Electron] Paths:');
    console.log('  SERVER_ENTRY:', SERVER_ENTRY);
    console.log('  CLIENT_DIST:', CLIENT_DIST);
    console.log('  DATA_DIR:', DATA_DIR);
    console.log('  isDev:', isDev);
    console.log('  exists(SERVER_ENTRY):', existsSync(SERVER_ENTRY));
    console.log('  exists(CLIENT_DIST):', existsSync(CLIENT_DIST));

    if (isDev) {
      // In dev, use tsx to run TypeScript directly
      const tsxBin = resolve(ROOT_DIR, 'node_modules', '.bin', 'tsx');
      const { fork } = require('child_process');
      serverProcess = fork(SERVER_ENTRY, [], {
        env,
        execArgv: [],
        execPath: tsxBin,
        stdio: ['pipe', 'pipe', 'pipe', 'ipc'],
      });
    } else {
      // In production, use spawn with ELECTRON_RUN_AS_NODE to run as plain Node.js
      // fork() in packaged Electron can be unreliable
      env.ELECTRON_RUN_AS_NODE = '1';
      serverProcess = spawn(process.execPath, [SERVER_ENTRY], {
        env,
        stdio: ['pipe', 'pipe', 'pipe'],
        windowsHide: true,
      });
    }

    const proc = serverProcess!;
    let started = false;
    const timeout = setTimeout(() => {
      if (!started) {
        started = true;
        console.log('[Electron] Server ready detection timed out, proceeding anyway');
        res();
      }
    }, 5000);

    proc.stdout?.on('data', (data: Buffer) => {
      const msg = data.toString();
      console.log('[Server]', msg.trim());
      // Match our console.log: "Shipyard server running on http://..."
      if (!started && (msg.includes('running on') || msg.includes(`${PORT}`))) {
        started = true;
        clearTimeout(timeout);
        res();
      }
    });

    proc.stderr?.on('data', (data: Buffer) => {
      console.error('[Server:err]', data.toString().trim());
    });

    proc.on('error', (err) => {
      console.error('[Electron] Server spawn error:', err);
      if (!started) {
        started = true;
        clearTimeout(timeout);
        reject(err);
      }
    });

    proc.on('exit', (code) => {
      console.log(`[Server] Process exited with code ${code}`);
      serverProcess = null;
      if (!started) {
        started = true;
        clearTimeout(timeout);
        reject(new Error(`Server exited with code ${code}`));
      }
    });
  });
}

function stopServer() {
  if (serverProcess) {
    serverProcess.kill('SIGTERM');
    serverProcess = null;
  }
}

// ── Window ─────────────────────────────────────────────────────────

let mainWindow: BrowserWindow | null = null;
let tray: Tray | null = null;
let isQuitting = false;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 900,
    minHeight: 600,
    title: 'Shipyard',
    icon: existsSync(ICON_PATH) ? ICON_PATH : undefined,
    backgroundColor: '#09090b',
    show: false,
    webPreferences: {
      preload: join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  // In dev mode with Vite, load from dev server; otherwise from Fastify
  if (isDev && process.env.VITE_DEV_SERVER) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER);
  } else {
    mainWindow.loadURL(`http://127.0.0.1:${PORT}`);
  }

  mainWindow.once('ready-to-show', () => {
    mainWindow?.show();
    if (isDev) {
      mainWindow?.webContents.openDevTools({ mode: 'detach' });
    }
  });

  // Open external links in default browser
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('http')) shell.openExternal(url);
    return { action: 'deny' };
  });

  // Minimize to tray instead of closing
  mainWindow.on('close', (e) => {
    if (!isQuitting) {
      e.preventDefault();
      mainWindow?.hide();
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// ── Tray ───────────────────────────────────────────────────────────

function createTray() {
  const icon = existsSync(ICON_PATH)
    ? nativeImage.createFromPath(ICON_PATH).resize({ width: 16, height: 16 })
    : nativeImage.createEmpty();

  tray = new Tray(icon);
  tray.setToolTip('Shipyard');

  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'Show Shipyard',
      click: () => {
        mainWindow?.show();
        mainWindow?.focus();
      },
    },
    { type: 'separator' },
    {
      label: 'Quit',
      click: () => {
        isQuitting = true;
        app.quit();
      },
    },
  ]);

  tray.setContextMenu(contextMenu);

  tray.on('double-click', () => {
    mainWindow?.show();
    mainWindow?.focus();
  });
}

// ── App lifecycle ──────────────────────────────────────────────────

const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      mainWindow.show();
      mainWindow.focus();
    }
  });

  app.on('before-quit', () => {
    isQuitting = true;
    stopServer();
  });

  app.whenReady().then(async () => {
    try {
      await startServer();
      createWindow();
      createTray();
    } catch (err) {
      console.error('[Electron] Failed to start:', err);
      dialog.showErrorBox(
        'Shipyard - Failed to Start',
        `Could not start the server.\n\n${err instanceof Error ? err.message : String(err)}`
      );
      app.quit();
    }
  });

  app.on('window-all-closed', () => {
    // Keep running in tray on all platforms
  });

  app.on('activate', () => {
    if (mainWindow === null) {
      createWindow();
    } else {
      mainWindow.show();
    }
  });
}
