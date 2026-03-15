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
  type: string; // 'shell' | 'dev' | 'claude' | 'ai-resolve'
  title: string;
  pty: import('node-pty').IPty;
  createdAt: string;
  taskId?: string;
}

const sessions = new Map<string, TerminalSession>();

export function isAvailable(): boolean {
  return nodePty !== null;
}

function getDefaultShell(): string {
  if (os === 'win32') {
    // PowerShell has PSReadLine (arrow-key history, autocomplete) and much
    // better ConPTY support than cmd.exe.  COMSPEC points to cmd.exe which
    // doesn't handle escape sequences well through ConPTY.
    return 'powershell.exe';
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
  taskId?: string,
): Promise<string | null> {
  if (!nodePty) return null;

  const id = nanoid(10);
  const shell = getDefaultShell();

  const env: Record<string, string> = {
    ...process.env as Record<string, string>,
    TERM: 'xterm-256color',
    COLORTERM: 'truecolor',
    HISTSIZE: '10000',
    HISTFILESIZE: '20000',
    HISTCONTROL: 'ignoredups:erasedups',
  };

  // Build initial command based on type
  let shellArgs: string[] = [];
  let initialCommand: string | null = null;

  if (os === 'win32') {
    // Windows: PowerShell with -NoLogo for cleaner startup
    shellArgs = ['-NoLogo'];
    if (type === 'claude') {
      env['CLAUDECODE'] = '';
      initialCommand = 'claude';
    } else if (type === 'claude-yolo' || type === 'ai-resolve') {
      env['CLAUDECODE'] = '';
      initialCommand = 'claude --dangerously-skip-permissions';
    } else if (type === 'dev') {
      initialCommand = await detectDevCommand(projectPath);
    }
  } else {
    // Linux/macOS: interactive login shell (enables readline + history)
    shellArgs = ['-il'];
    if (type === 'claude') {
      initialCommand = 'claude';
    } else if (type === 'claude-yolo' || type === 'ai-resolve') {
      initialCommand = 'claude --dangerously-skip-permissions';
    } else if (type === 'dev') {
      initialCommand = await detectDevCommand(projectPath);
    }
  }

  const maxLen = 18;
  const shortName = projectName && projectName.length > maxLen
    ? projectName.slice(0, maxLen - 3) + '...'
    : projectName || projectId;
  const typeLabels: Record<string, string> = { claude: 'Claude', 'claude-yolo': 'Claude', dev: 'Dev', shell: 'Shell', 'ai-resolve': 'AI' };
  const title = `[${shortName}] ${typeLabels[type] || 'Shell'}`;

  const spawnOptions: Record<string, any> = {
    name: 'xterm-256color',
    cols,
    rows,
    cwd: projectPath,
    env,
    handleFlowControl: true,
  };

  // On Windows, explicitly use ConPTY for better interactive prompt support
  if (os === 'win32') {
    spawnOptions.useConpty = true;
  }

  const pty = nodePty.spawn(shell, shellArgs, spawnOptions);

  const session: TerminalSession = {
    id,
    projectId,
    type,
    title,
    pty,
    createdAt: new Date().toISOString(),
    ...(taskId ? { taskId } : {}),
  };

  sessions.set(id, session);

  // Send initial command after shell initializes
  // Use a longer delay on Windows (PowerShell startup is slower)
  if (initialCommand) {
    const delay = os === 'win32' ? 800 : 400;
    setTimeout(() => {
      pty.write(initialCommand + '\r');
    }, delay);
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

export function listAiSessions(): Omit<TerminalSession, 'pty'>[] {
  const list: Omit<TerminalSession, 'pty'>[] = [];
  for (const session of sessions.values()) {
    if (session.taskId) {
      const { pty, ...rest } = session;
      list.push(rest);
    }
  }
  return list;
}

export function writeToSession(id: string, data: string): boolean {
  const session = sessions.get(id);
  if (!session) return false;
  try {
    session.pty.write(data);
  } catch { return false; }
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
