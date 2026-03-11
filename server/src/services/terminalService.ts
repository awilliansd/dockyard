import { platform } from 'os';
import { nanoid } from 'nanoid';
import { readFile } from 'fs/promises';
import { join } from 'path';

const os = platform();

// Dynamic import of node-pty (optional dependency)
let nodePty: typeof import('node-pty') | null = null;

try {
  nodePty = await import('node-pty');
} catch {
  console.log('node-pty not available — integrated terminal disabled (native launchers still work)');
}

export interface TerminalSession {
  id: string;
  projectId: string;
  type: string; // 'shell' | 'dev' | 'claude'
  title: string;
  pty: import('node-pty').IPty;
  createdAt: string;
}

const sessions = new Map<string, TerminalSession>();

export function isAvailable(): boolean {
  return nodePty !== null;
}

function getDefaultShell(): string {
  if (os === 'win32') {
    return process.env.COMSPEC || 'powershell.exe';
  }
  return process.env.SHELL || '/bin/bash';
}

async function detectDevCommand(projectPath: string): Promise<string | null> {
  try {
    const pkg = JSON.parse(await readFile(join(projectPath, 'package.json'), 'utf-8'));
    if (pkg.scripts?.dev) return 'pnpm dev';
    if (pkg.scripts?.start) return 'pnpm start';
    if (pkg.scripts?.serve) return 'pnpm serve';
  } catch {}
  return null;
}

export async function createSession(
  projectId: string,
  projectPath: string,
  type: string,
  cols: number,
  rows: number,
  projectName?: string,
): Promise<string | null> {
  if (!nodePty) return null;

  const id = nanoid(10);
  const shell = getDefaultShell();

  const env: Record<string, string> = {
    ...process.env as Record<string, string>,
    TERM: 'xterm-256color',
    COLORTERM: 'truecolor',
  };

  // Build initial command based on type
  let shellArgs: string[] = [];
  let initialCommand: string | null = null;

  if (os === 'win32') {
    // Windows: use powershell
    shellArgs = [];
    if (type === 'claude') {
      env['CLAUDECODE'] = '';
      initialCommand = 'claude';
    } else if (type === 'claude-yolo') {
      env['CLAUDECODE'] = '';
      initialCommand = 'claude --dangerously-skip-permissions';
    } else if (type === 'dev') {
      initialCommand = await detectDevCommand(projectPath);
    }
  } else {
    // Linux/macOS: use login shell
    shellArgs = ['-l'];
    if (type === 'claude') {
      initialCommand = 'claude';
    } else if (type === 'claude-yolo') {
      initialCommand = 'claude --dangerously-skip-permissions';
    } else if (type === 'dev') {
      initialCommand = await detectDevCommand(projectPath);
    }
  }

  const maxLen = 18;
  const shortName = projectName && projectName.length > maxLen
    ? projectName.slice(0, maxLen - 3) + '...'
    : projectName || projectId;
  const typeLabels: Record<string, string> = { claude: 'Claude', 'claude-yolo': 'Claude', dev: 'Dev', shell: 'Shell' };
  const title = `[${shortName}] ${typeLabels[type] || 'Shell'}`;

  const pty = nodePty.spawn(shell, shellArgs, {
    name: 'xterm-256color',
    cols,
    rows,
    cwd: projectPath,
    env,
  });

  const session: TerminalSession = {
    id,
    projectId,
    type,
    title,
    pty,
    createdAt: new Date().toISOString(),
  };

  sessions.set(id, session);

  // Send initial command after a short delay to let the shell initialize
  if (initialCommand) {
    setTimeout(() => {
      pty.write(initialCommand + '\r');
    }, 300);
  }

  return id;
}

export function getSession(id: string): TerminalSession | null {
  return sessions.get(id) || null;
}

export function killSession(id: string): boolean {
  const session = sessions.get(id);
  if (!session) return false;

  try {
    session.pty.kill();
  } catch {}
  sessions.delete(id);
  return true;
}

export function listSessions(projectId?: string): Omit<TerminalSession, 'pty'>[] {
  const list: Omit<TerminalSession, 'pty'>[] = [];
  for (const session of sessions.values()) {
    if (!projectId || session.projectId === projectId) {
      const { pty, ...rest } = session;
      list.push(rest);
    }
  }
  return list;
}

export function resizeSession(id: string, cols: number, rows: number): boolean {
  const session = sessions.get(id);
  if (!session) return false;
  try {
    session.pty.resize(cols, rows);
  } catch {}
  return true;
}

// Clean up all sessions on server shutdown
function cleanupAll() {
  for (const session of sessions.values()) {
    try { session.pty.kill(); } catch {}
  }
  sessions.clear();
}

process.on('exit', cleanupAll);
process.on('SIGINT', () => { cleanupAll(); process.exit(0); });
process.on('SIGTERM', () => { cleanupAll(); process.exit(0); });
