import { app, BrowserWindow, Tray, Menu, nativeImage, shell, dialog, MenuItemConstructorOptions } from 'electron';
import { join, resolve } from 'path';
import { existsSync, mkdirSync, appendFileSync, readFileSync } from 'fs';
import { spawn, type ChildProcess } from 'child_process';
import http from 'http';

// ── Paths ──────────────────────────────────────────────────────────

const isDev = !app.isPackaged;

const DEV_ROOT = (() => {
  const candidates = [
    resolve(__dirname, '..', '..'), // electron/dist -> repo root
    resolve(__dirname, '..'),       // electron -> repo root
  ];
  for (const c of candidates) {
    if (existsSync(join(c, 'package.json')) && existsSync(join(c, 'client')) && existsSync(join(c, 'server'))) {
      return c;
    }
  }
  return resolve(__dirname, '..');
})();

const ROOT_DIR = isDev
  ? DEV_ROOT
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

/** HTTP GET health check — resolves true if server responds, false on error */
function checkServerReady(): Promise<boolean> {
  return new Promise((resolve) => {
    const req = http.request(
      { hostname: '127.0.0.1', port: PORT, path: '/api/settings', method: 'GET', timeout: 1000 },
      (res) => {
        res.resume(); // drain response
        resolve(res.statusCode !== undefined && res.statusCode < 500);
      },
    );
    req.on('error', () => resolve(false));
    req.on('timeout', () => { req.destroy(); resolve(false); });
    req.end();
  });
}

/** Poll the server with HTTP requests until it responds or we give up */
async function waitForServer(maxAttempts = 30, intervalMs = 500): Promise<void> {
  for (let i = 0; i < maxAttempts; i++) {
    if (await checkServerReady()) {
      console.log(`[Electron] Server confirmed ready (attempt ${i + 1})`);
      return;
    }
    await new Promise((r) => setTimeout(r, intervalMs));
  }
  console.log('[Electron] Server health check timed out, proceeding anyway');
}

function startServer(): Promise<void> {
  return new Promise((res, reject) => {
    lastServerErrorHint = null;
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
      const tsxBin = resolve(
        ROOT_DIR,
        'node_modules',
        '.bin',
        process.platform === 'win32' ? 'tsx.cmd' : 'tsx'
      );
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

    proc.stdout?.on('data', (data: Buffer) => {
      const msg = data.toString();
      console.log('[Server]', msg.trim());
      // Match our console.log: "Shipyard server running on http://..."
      if (!started && (msg.includes('running on') || msg.includes(`${PORT}`))) {
        started = true;
        // Server reported ready via stdout — confirm with HTTP health check
        waitForServer(10, 300).then(() => res());
      }
    });

    proc.stderr?.on('data', (data: Buffer) => {
      const msg = data.toString();
      console.error('[Server:err]', msg.trim());
      if (isPortInUseError(msg)) {
        lastServerErrorHint = msg.trim();
      }
    });

    proc.on('error', (err) => {
      console.error('[Electron] Server spawn error:', err);
      if (!started) {
        started = true;
        reject(err);
      }
    });

    proc.on('exit', (code) => {
      console.log(`[Server] Process exited with code ${code}`);
      serverProcess = null;
      if (!started) {
        started = true;
        reject(new Error(`Server exited with code ${code}`));
        return;
      }
      if (!isQuitting) {
        if (lastServerErrorHint) {
          logElectron('[Electron] Server exited due to port conflict:', lastServerErrorHint);
          dialog.showErrorBox(
            'Shipyard - Port In Use',
            `The Shipyard server could not start because the port is already in use.\n\nDetails:\n${lastServerErrorHint}\n\nClose other instances or free the port and try again.`
          );
          return;
        }
        restartServerWithBackoff();
      }
    });

    // Fallback: if stdout never matches, poll with HTTP health checks
    setTimeout(() => {
      if (!started) {
        started = true;
        console.log('[Electron] Stdout detection timed out, falling back to HTTP polling');
        waitForServer().then(() => res());
      }
    }, 5000);
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
let splashWindow: BrowserWindow | null = null;
let restartInProgress = false;
let restartTimestamps: number[] = [];
let lastServerErrorHint: string | null = null;

function delay(ms: number) {
  return new Promise((res) => setTimeout(res, ms));
}

function getElectronLogPath() {
  return join(app.getPath('userData'), 'electron.log');
}

function logElectron(msg: string, err?: unknown) {
  const line = `[${new Date().toISOString()}] ${msg}${err ? ` | ${String(err)}` : ''}\n`;
  try {
    appendFileSync(getElectronLogPath(), line, 'utf-8');
  } catch {
    // best-effort logging only
  }
  console.log(msg, err ?? '');
}

function isPortInUseError(msg: string) {
  const lower = msg.toLowerCase();
  return lower.includes('eaddrinuse') || lower.includes('already in use') || (lower.includes('port') && lower.includes('in use'));
}

function getTargetUrl() {
  if (isDev && process.env.VITE_DEV_SERVER) {
    return process.env.VITE_DEV_SERVER;
  }
  return `http://127.0.0.1:${PORT}`;
}

async function restartServerWithBackoff() {
  if (restartInProgress || isQuitting) return;
  restartInProgress = true;

  const now = Date.now();
  restartTimestamps = restartTimestamps.filter((t) => now - t < 30000);
  restartTimestamps.push(now);
  if (restartTimestamps.length > 3) {
    logElectron('[Electron] Server keeps crashing. Aborting auto-restart.');
    dialog.showErrorBox(
      'Shipyard - Server Failure',
      `The server crashed multiple times during startup.\n\nCheck logs at:\n${getElectronLogPath()}`
    );
    restartInProgress = false;
    return;
  }

  const backoffMs = 1500;
  logElectron(`[Electron] Server exited. Restarting in ${backoffMs}ms...`);
  await delay(backoffMs);

  try {
    await startServer();
    const targetUrl = getTargetUrl();
    try {
      await waitForServerReady(targetUrl, 12000, 400);
    } catch (err) {
      logElectron('[Electron] Server readiness check failed after restart:', err);
    }
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.reload();
      mainWindow.show();
    }
  } catch (err) {
    logElectron('[Electron] Server restart failed:', err);
  } finally {
    restartInProgress = false;
  }
}

async function waitForServerReady(url: string, timeoutMs = 15000, intervalMs = 300): Promise<void> {
  const start = Date.now();
  const urlObj = new URL(url);

  logElectron(`[Electron] Waiting for server at ${url} (timeout ${timeoutMs}ms)`);
  while (Date.now() - start < timeoutMs) {
    try {
      await new Promise<void>((resolve, reject) => {
        const req = http.get(
          {
            hostname: urlObj.hostname,
            port: urlObj.port,
            path: '/',
            timeout: 1500,
          },
          (res) => {
            res.resume();
            resolve();
          }
        );
        req.on('error', reject);
        req.on('timeout', () => {
          req.destroy(new Error('timeout'));
        });
      });
      return;
    } catch {
      await delay(intervalMs);
    }
  }

  throw new Error(`Server did not respond within ${timeoutMs}ms`);
}

function createSplashWindow() {
  if (splashWindow) return;

  let logoDataUrl = '';
  try {
    if (existsSync(ICON_PATH)) {
      const buf = readFileSync(ICON_PATH);
      logoDataUrl = `data:image/png;base64,${buf.toString('base64')}`;
    }
  } catch {
    // ignore logo load failures
  }

  splashWindow = new BrowserWindow({
    width: 520,
    height: 320,
    resizable: false,
    minimizable: false,
    maximizable: false,
    frame: false,
    show: true,
    backgroundColor: '#0b0b0f',
    alwaysOnTop: true,
    transparent: false,
    webPreferences: {
      sandbox: true,
      contextIsolation: true,
    },
  });

  const logoMarkup = logoDataUrl
    ? `<img src="${logoDataUrl}" alt="Shipyard" style="width:64px;height:64px;margin:0 auto 8px;display:block;filter: drop-shadow(0 6px 18px rgba(0,0,0,0.5));" />`
    : '';

  const html = `
    <!doctype html>
    <html>
      <head>
        <meta charset="utf-8" />
        <title>Shipyard</title>
        <style>
          :root { color-scheme: dark; }
          body {
            margin: 0;
            background: #0b0b0f;
            color: #e5e7eb;
            font-family: "Segoe UI", system-ui, sans-serif;
            display: grid;
            place-items: center;
            height: 100vh;
          }
          .card {
            text-align: center;
            padding: 0;
            min-width: 0;
            border-radius: 0;
            background: transparent;
            box-shadow: none;
          }
          .logo {
            font-size: 20px;
            letter-spacing: 0.08em;
            text-transform: uppercase;
          }
          .spinner {
            width: 36px;
            height: 36px;
            border: 3px solid #2a2a36;
            border-top-color: #7dd3fc;
            border-radius: 50%;
            margin: 16px auto 4px;
            animation: spin 0.9s linear infinite;
          }
          .sub {
            font-size: 12px;
            color: #94a3b8;
          }
          @keyframes spin { to { transform: rotate(360deg); } }
        </style>
      </head>
      <body>
        <div class="card">
          ${logoMarkup}
          <div class="logo">Shipyard</div>
          <div class="spinner"></div>
          <div class="sub">Carregando...</div>
        </div>
      </body>
    </html>
  `;

  splashWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);
  splashWindow.on('closed', () => {
    splashWindow = null;
  });
}

function closeSplashWindow() {
  if (splashWindow) {
    splashWindow.close();
    splashWindow = null;
  }
}

function loadWindowWithRetry(win: BrowserWindow, url: string) {
  let shown = false;
  let retries = 0;
  const maxRetries = 12;

  const showOnce = () => {
    if (shown) return;
    shown = true;
    win.show();
    if (isDev) {
      win.webContents.openDevTools({ mode: 'detach' });
    }
    closeSplashWindow();
  };

  const tryLoad = () => {
    win.loadURL(url).catch((err) => {
      console.warn('[Electron] loadURL failed:', err);
    });
  };

  win.webContents.on('did-fail-load', (_e, errorCode, errorDescription, validatedURL, isMainFrame) => {
    if (!isMainFrame) return;
    if (validatedURL !== url) return;
    // Ignore ERR_ABORTED (navigation cancelled)
    if (errorCode === -3) return;

    if (retries < maxRetries) {
      const delayMs = Math.min(2000, 200 + retries * 200);
      retries += 1;
      logElectron(`[Electron] Load failed (${errorDescription}). Retrying in ${delayMs}ms...`);
      setTimeout(tryLoad, delayMs);
    } else {
      logElectron('[Electron] Load failed too many times, showing window anyway.');
      showOnce();
    }
  });

  win.webContents.once('did-finish-load', () => {
    showOnce();
  });

  tryLoad();
}

function createAppMenu() {
  const isMac = process.platform === 'darwin';

  const template: MenuItemConstructorOptions[] = [
    ...(isMac
      ? [{
          label: app.name,
          submenu: [
            { role: 'about' },
            { type: 'separator' },
            { role: 'services' },
            { type: 'separator' },
            { role: 'hide' },
            { role: 'hideOthers' },
            { role: 'unhide' },
            { type: 'separator' },
            { role: 'quit' }
          ]
        } as MenuItemConstructorOptions]
      : []),
    {
      label: 'File',
      submenu: [
        {
          label: 'Settings',
          accelerator: 'CmdOrCtrl+,',
          click: async () => {
            mainWindow?.webContents.send('menu-event', 'navigate-settings');
          }
        },
        { type: 'separator' },
        isMac ? { role: 'close' } : { role: 'quit' }
      ]
    },
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        ...(isMac
          ? [
              { role: 'pasteAndMatchStyle' },
              { role: 'delete' },
              { role: 'selectAll' },
              { type: 'separator' },
              {
                label: 'Speech',
                submenu: [
                  { role: 'startSpeaking' },
                  { role: 'stopSpeaking' }
                ]
              }
            ] as MenuItemConstructorOptions[]
          : [
              { role: 'delete' },
              { type: 'separator' },
              { role: 'selectAll' }
            ] as MenuItemConstructorOptions[])
      ]
    },
    {
      label: 'View',
      submenu: [
        { role: 'reload' },
        { role: 'forceReload' },
        { role: 'toggleDevTools' },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' }
      ]
    },
    {
      label: 'Window',
      submenu: [
        { role: 'minimize' },
        { role: 'zoom' },
        ...(isMac
          ? [
              { type: 'separator' },
              { role: 'front' },
              { type: 'separator' },
              { role: 'window' }
            ] as MenuItemConstructorOptions[]
          : [
              { role: 'close' }
            ] as MenuItemConstructorOptions[])
      ]
    },
    {
      role: 'help',
      submenu: [
        {
          label: 'Documentation',
          click: async () => {
            mainWindow?.webContents.send('menu-event', 'navigate-help');
          }
        },
        {
          label: 'About',
          click: async () => {
            mainWindow?.webContents.send('menu-event', 'show-about');
          }
        }
      ]
    }
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

function createWindow(targetUrl: string) {
  createAppMenu();

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

  loadWindowWithRetry(mainWindow, targetUrl);
  loadWindowWithRetry(mainWindow, targetUrl);

  // Open external links in default browser
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('http')) shell.openExternal(url);
    return { action: 'deny' };
  });

  // Intercept in-page navigation (e.g. clicking <a href="..."> without target="_blank")
  mainWindow.webContents.on('will-navigate', (event, url) => {
    // Allow same-origin navigation (e.g. React Router, hash changes)
    const currentURL = mainWindow?.webContents.getURL() || '';
    const isSameOrigin = new URL(url).origin === new URL(currentURL).origin;
    if (!isSameOrigin && url.startsWith('http')) {
      event.preventDefault();
      shell.openExternal(url);
    }
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
      createSplashWindow();
      await startServer();
      const targetUrl = getTargetUrl();
      if (!isDev || !process.env.VITE_DEV_SERVER) {
        try {
          await waitForServerReady(targetUrl);
        } catch (err) {
          logElectron('[Electron] Server readiness check failed, will rely on load retries:', err);
        }
      }
      createWindow(targetUrl);
      createTray();
    } catch (err) {
      logElectron('[Electron] Failed to start:', err);
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
      createWindow(getTargetUrl());
    } else {
      mainWindow.show();
    }
  });
}
