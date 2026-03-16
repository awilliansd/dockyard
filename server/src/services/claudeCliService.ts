import { execFile, spawn } from 'child_process';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);
const isWindows = process.platform === 'win32';

// Cache CLI availability and resolved path (re-check every 60s)
let cliAvailable: boolean | null = null;
let cliPath: string = 'claude'; // resolved full path on Windows
let lastCheck = 0;

export async function isCliAvailable(): Promise<boolean> {
  try {
    await execFileAsync('claude', ['--version'], {
      timeout: 5000,
      windowsHide: true,
    });
    // On Windows, resolve the full path so spawn() can find it without shell
    if (isWindows) {
      try {
        const { stdout } = await execFileAsync('where', ['claude'], {
          timeout: 5000,
          windowsHide: true,
        });
        const resolved = stdout.trim().split(/\r?\n/)[0];
        if (resolved) cliPath = resolved;
      } catch {
        // If 'where' fails, keep using 'claude' and rely on shell fallback
      }
    }
    return true;
  } catch {
    return false;
  }
}

export async function getCliStatus(): Promise<boolean> {
  const now = Date.now();
  if (cliAvailable !== null && now - lastCheck < 60_000) return cliAvailable;
  cliAvailable = await isCliAvailable();
  lastCheck = now;
  return cliAvailable;
}

export interface RunPromptOptions {
  input?: string;
  model?: string;
  maxTurns?: number;
  outputFormat?: 'text' | 'json';
  timeout?: number;
  cwd?: string;
}

function buildCliArgs(options?: RunPromptOptions): string[] {
  const args = ['-p'];
  if (options?.model) args.push('--model', options.model);
  if (options?.maxTurns) args.push('--max-turns', String(options.maxTurns));
  if (options?.outputFormat) args.push('--output-format', options.outputFormat);
  args.push('--no-session-persistence');
  return args;
}

function buildCliEnv(): NodeJS.ProcessEnv {
  // Remove ANTHROPIC_API_KEY to force subscription usage
  const env = { ...process.env };
  delete env.ANTHROPIC_API_KEY;
  return env;
}

function buildStdinContent(prompt: string, input?: string): string {
  return input ? `${prompt}\n\n${input}` : prompt;
}

/**
 * Run a prompt and return the full response. Uses activity-based timeout
 * that resets whenever the CLI produces output (stdout or stderr).
 */
export async function runPrompt(prompt: string, options?: RunPromptOptions): Promise<string> {
  const args = buildCliArgs(options);
  const env = buildCliEnv();

  return new Promise<string>((resolve, reject) => {
    const proc = spawn(cliPath, args, {
      env,
      cwd: options?.cwd,
      stdio: ['pipe', 'pipe', 'pipe'],
      windowsHide: true,
    });

    let stdout = '';
    let stderr = '';
    const timeout = options?.timeout ?? 60_000;

    // Activity-based timeout: resets on every stdout/stderr chunk
    let timer: NodeJS.Timeout;
    const resetTimer = () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        proc.kill();
        reject(new Error(`Claude CLI timed out (no output for ${Math.round(timeout / 1000)}s)`));
      }, timeout);
    };
    resetTimer();

    proc.stdout.on('data', (data: Buffer) => { stdout += data.toString(); resetTimer(); });
    proc.stderr.on('data', (data: Buffer) => { stderr += data.toString(); resetTimer(); });
    proc.on('close', (code) => {
      clearTimeout(timer);
      if (code === 0) {
        resolve(stdout.trim());
      } else {
        reject(new Error(stderr.trim() || `Claude CLI exited with code ${code}`));
      }
    });
    proc.on('error', (err) => {
      clearTimeout(timer);
      reject(err);
    });

    // Pipe prompt (+ optional input) via stdin
    proc.stdin.write(buildStdinContent(prompt, options?.input));
    proc.stdin.end();
  });
}

/**
 * Stream a prompt response chunk-by-chunk via async generator.
 * Each yield is a text fragment from stdout as it arrives.
 * Uses activity-based timeout that resets on each chunk.
 */
export async function* streamPrompt(prompt: string, options?: RunPromptOptions): AsyncGenerator<string> {
  const args = buildCliArgs(options);
  const env = buildCliEnv();

  const proc = spawn(cliPath, args, {
    env,
    cwd: options?.cwd,
    stdio: ['pipe', 'pipe', 'pipe'],
    windowsHide: true,
  });

  // Pipe prompt via stdin
  proc.stdin.write(buildStdinContent(prompt, options?.input));
  proc.stdin.end();

  const activityTimeout = options?.timeout ?? 120_000;
  let timedOut = false;
  let timer: NodeJS.Timeout = null as unknown as NodeJS.Timeout;

  const resetTimer = () => {
    clearTimeout(timer);
    timer = setTimeout(() => {
      timedOut = true;
      proc.kill();
    }, activityTimeout);
  };

  resetTimer();

  let stderr = '';
  proc.stderr.on('data', (data: Buffer) => {
    stderr += data.toString();
    resetTimer();
  });

  try {
    // Node readable streams are async iterable — yields Buffer chunks as they arrive
    for await (const chunk of proc.stdout) {
      resetTimer();
      yield chunk.toString();
    }
  } finally {
    clearTimeout(timer);
  }

  if (timedOut) {
    throw new Error(`Claude CLI timed out (no output for ${Math.round(activityTimeout / 1000)}s)`);
  }

  // Wait for process to fully close
  const code = await new Promise<number | null>((resolve) => {
    if (proc.exitCode !== null) resolve(proc.exitCode);
    else proc.on('close', resolve);
  });

  if (code !== 0) {
    throw new Error(stderr.trim() || `Claude CLI exited with code ${code}`);
  }
}
