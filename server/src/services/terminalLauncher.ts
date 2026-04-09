import { spawn, execFileSync } from 'child_process';
import { readFile } from 'fs/promises';
import { join } from 'path';
import { platform } from 'os';
import { getSettings } from './settingsStore.js';

export type TerminalType = 'assistant' | 'dev' | 'shell';
type AiCliRuntime = 'openclaude' | 'codex' | 'gemini' | 'omniroute';

const os = platform();

const typeLabel: Record<TerminalType, string> = {
  assistant: 'AI Assistant',
  dev: 'Dev',
  shell: 'Shell',
};

function normalizeRuntime(runtime?: string): AiCliRuntime {
  if (runtime === 'openclaude' || runtime === 'codex' || runtime === 'gemini' || runtime === 'omniroute') return runtime;
  const configured = getSettings().aiCliRuntime;
  if (configured === 'openclaude' || configured === 'codex' || configured === 'gemini' || configured === 'omniroute') return configured;
  return 'openclaude';
}

function runtimeLabel(runtime: AiCliRuntime): string {
  if (runtime === 'codex') return 'Codex';
  if (runtime === 'gemini') return 'Gemini';
  if (runtime === 'omniroute') return 'OmniRoute';
  return 'Open Claude';
}

function buildAssistantCommand(runtime: AiCliRuntime, useSkip: boolean): string {
  if (runtime === 'codex') return 'codex';
  if (runtime === 'gemini') return 'gemini';
  if (runtime === 'omniroute') return 'omniroute';
  return useSkip ? 'openclaude --dangerously-skip-permissions' : 'openclaude';
}

function buildTitle(projectName: string, type: TerminalType): string {
  const label = typeLabel[type];
  const maxLen = 18;
  const short = projectName.length > maxLen
    ? projectName.slice(0, maxLen - 3) + '...'
    : projectName;
  return `[${short}] ${label}`;
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

function spawnDetached(cmd: string, args: string[], useShell = false) {
  spawn(cmd, args, {
    detached: true,
    stdio: 'ignore',
    shell: useShell,
  }).unref();
}

// Detect available terminal emulator on Linux
const LINUX_TERMINALS = [
  { cmd: 'gnome-terminal', args: (p: string, t: string, c?: string) => {
    const a = ['--title', t, '--working-directory', p];
    if (c) a.push('--', 'bash', '-c', `${c}; exec bash`);
    return a;
  }},
  { cmd: 'konsole', args: (p: string, _t: string, c?: string) => {
    const a = ['--workdir', p];
    if (c) a.push('-e', 'bash', '-c', `${c}; exec bash`);
    return a;
  }},
  { cmd: 'xfce4-terminal', args: (p: string, t: string, c?: string) => {
    const a = ['--title', t, '--working-directory', p];
    if (c) a.push('-e', `bash -c '${c.replace(/'/g, "'\\''") }; exec bash'`);
    return a;
  }},
  { cmd: 'mate-terminal', args: (p: string, t: string, c?: string) => {
    const a = ['--title', t, '--working-directory', p];
    if (c) a.push('-e', `bash -c '${c.replace(/'/g, "'\\''") }; exec bash'`);
    return a;
  }},
  { cmd: 'x-terminal-emulator', args: (p: string, _t: string, c?: string) => {
    // Debian/Ubuntu alternatives system — basic fallback
    const a = ['-e', 'bash'];
    if (c) a.splice(0, a.length, '-e', 'bash', '-c', `cd '${p.replace(/'/g, "'\\''") }' && ${c}; exec bash`);
    return a;
  }},
  { cmd: 'xterm', args: (p: string, t: string, c?: string) => {
    const a = ['-title', t, '-e', 'bash', '-c', `cd '${p.replace(/'/g, "'\\''") }'${c ? ` && ${c}` : ''}; exec bash`];
    return a;
  }},
];

let _cachedLinuxTerminal: typeof LINUX_TERMINALS[0] | null | undefined;

function findLinuxTerminal(): typeof LINUX_TERMINALS[0] | null {
  if (_cachedLinuxTerminal !== undefined) return _cachedLinuxTerminal;
  for (const term of LINUX_TERMINALS) {
    try {
      execFileSync('which', [term.cmd], { stdio: 'ignore' });
      _cachedLinuxTerminal = term;
      return term;
    } catch {}
  }
  _cachedLinuxTerminal = null;
  return null;
}

// Linux: detect and launch available terminal emulator
function launchLinuxTerminal(projectPath: string, title: string, command?: string) {
  const term = findLinuxTerminal();
  if (!term) {
    throw new Error('No supported terminal emulator found. Install gnome-terminal, konsole, xfce4-terminal, or xterm.');
  }
  spawnDetached(term.cmd, term.args(projectPath, title, command));
}

// macOS: osascript to open Terminal.app with title and command
function launchMacTerminal(projectPath: string, title: string, command?: string) {
  const escapedTitle = title.replace(/"/g, '\\"');
  const escapedPath = projectPath.replace(/"/g, '\\"');
  const cdCmd = `cd "${escapedPath}"`;
  const titleCmd = `printf '\\\\e]0;${escapedTitle}\\\\a'`;
  const fullCmd = command
    ? `${cdCmd} && ${titleCmd} && ${command}`
    : `${cdCmd} && ${titleCmd}`;

  const script = `tell application "Terminal"
  activate
  do script "${fullCmd.replace(/"/g, '\\"')}"
end tell`;

  spawnDetached('osascript', ['-e', script]);
}

// Windows: wt.exe with --title
function launchWindowsTerminal(projectPath: string, title: string, command?: string) {
  const args: string[] = ['-w', '0', 'nt', '-d', projectPath, '--title', title];
  if (command) {
    args.push('cmd.exe', '/k', command);
  }
  spawnDetached('wt.exe', args);
}

export async function launchTerminal(
  projectPath: string,
  type: TerminalType,
  projectName?: string,
  options?: { runtime?: string; skipPermissions?: boolean },
): Promise<void> {
  const runtime = normalizeRuntime(options?.runtime);
  const useSkip = options?.skipPermissions ?? false;
  const isAssistantType = type === 'assistant';
  const titleBase = isAssistantType ? runtimeLabel(runtime) : typeLabel[type];
  const title = projectName ? buildTitle(projectName, type).replace(typeLabel[type], titleBase) : titleBase;

  let command: string | undefined;
  switch (type) {
    case 'assistant':
      command = buildAssistantCommand(runtime, useSkip);
      break;
    case 'dev':
      command = (await detectDevCommand(projectPath)) || undefined;
      break;
    case 'shell':
      command = undefined;
      break;
  }

  if (os === 'linux') {
    // Linux: clear CLAUDECODE only for OpenClaude runtime
    if (isAssistantType && runtime === 'openclaude' && command) command = `unset CLAUDECODE && ${command}`;
    launchLinuxTerminal(projectPath, title, command);
  } else if (os === 'darwin') {
    // macOS: clear CLAUDECODE only for OpenClaude runtime
    if (isAssistantType && runtime === 'openclaude' && command) command = `unset CLAUDECODE && ${command}`;
    launchMacTerminal(projectPath, title, command);
  } else {
    // Windows: clear CLAUDECODE only for OpenClaude runtime
    if (isAssistantType && runtime === 'openclaude' && command) command = `set CLAUDECODE= && ${command}`;
    launchWindowsTerminal(projectPath, title, command);
  }
}

export async function openFolder(projectPath: string): Promise<void> {
  if (os === 'linux') {
    spawnDetached('xdg-open', [projectPath]);
  } else if (os === 'darwin') {
    spawnDetached('open', [projectPath]);
  } else {
    spawnDetached('explorer.exe', [projectPath]);
  }
}
