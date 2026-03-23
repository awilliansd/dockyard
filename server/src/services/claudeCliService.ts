import { execFile, spawn } from 'child_process';
import { promisify } from 'util';
import { readFile } from 'fs/promises';
import { join } from 'path';
import { homedir } from 'os';

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
    // Resolve the full path so spawn() can find it without shell
    const whichCmd = isWindows ? 'where' : 'which';
    try {
      const { stdout } = await execFileAsync(whichCmd, ['claude'], {
        timeout: 5000,
        windowsHide: true,
      });
      const resolved = stdout.trim().split(/\r?\n/)[0];
      if (resolved) cliPath = resolved;
    } catch {
      // If resolution fails, keep using 'claude' and rely on shell fallback
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

/**
 * Read the Claude CLI's OAuth token from ~/.claude/.credentials.json.
 * Returns the access token if valid, null otherwise.
 * This allows us to call the Anthropic API directly using the Max subscription
 * without spawning the CLI process (which has Windows stdout piping issues).
 */
let cachedOAuthToken: string | null = null;
let oauthTokenExpiry = 0;

export async function getOAuthToken(): Promise<string | null> {
  // Return cached token if still valid (with 5min buffer)
  if (cachedOAuthToken && Date.now() < oauthTokenExpiry - 5 * 60_000) {
    return cachedOAuthToken;
  }
  try {
    const credPath = join(homedir(), '.claude', '.credentials.json');
    const raw = await readFile(credPath, 'utf-8');
    const creds = JSON.parse(raw);
    const oauth = creds.claudeAiOauth;
    if (!oauth?.accessToken || !oauth?.expiresAt) return null;
    if (Date.now() > new Date(oauth.expiresAt).getTime()) return null;
    cachedOAuthToken = oauth.accessToken;
    oauthTokenExpiry = new Date(oauth.expiresAt).getTime();
    return cachedOAuthToken;
  } catch {
    return null;
  }
}

/**
 * Call the Anthropic API directly using the CLI's OAuth token.
 * This is faster and more reliable than spawning the CLI process,
 * especially on Windows where the CLI has stdout buffering issues.
 */
export async function callApiWithOAuth(
  systemPrompt: string,
  userMessage: string,
  options?: { model?: string; maxTokens?: number; timeout?: number }
): Promise<string> {
  const token = await getOAuthToken();
  if (!token) throw new Error('No OAuth token available');

  const controller = new AbortController();
  const timeout = options?.timeout ?? 30_000;
  const timer = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': token,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: options?.model ?? 'claude-haiku-4-5-20251001',
        max_tokens: options?.maxTokens ?? 1024,
        system: systemPrompt,
        messages: [{ role: 'user', content: userMessage }],
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`API error ${response.status}: ${body.slice(0, 200)}`);
    }

    const data = await response.json() as any;
    const text = data.content?.[0]?.type === 'text' ? data.content[0].text : '';
    return text.trim();
  } finally {
    clearTimeout(timer);
  }
}

export interface RunPromptOptions {
  input?: string;
  model?: string;
  outputFormat?: 'text' | 'json';
  timeout?: number;
  /** Absolute deadline — kills the process after this many ms regardless of activity */
  hardTimeout?: number;
  cwd?: string;
  /** Skip hooks, LSP, CLAUDE.md discovery — faster for simple prompts */
  bare?: boolean;
}

/**
 * Build CLI args with prompt as positional argument (after all flags).
 * This avoids Windows stdin piping issues where spawn() fails to deliver
 * piped data to the child process, causing the CLI to hang waiting for input.
 */
function buildCliArgs(prompt: string, options?: RunPromptOptions): string[] {
  const args: string[] = ['-p'];
  if (options?.model) args.push('--model', options.model);
  if (options?.outputFormat) args.push('--output-format', options.outputFormat);
  if (options?.bare) args.push('--bare');
  args.push('--no-session-persistence');
  // Prompt as positional argument — must come after all flags
  args.push(prompt);
  return args;
}

function buildCliEnv(): NodeJS.ProcessEnv {
  // Remove ANTHROPIC_API_KEY to force subscription usage
  const env = { ...process.env };
  delete env.ANTHROPIC_API_KEY;
  return env;
}


/**
 * Run a prompt and return the full response. Uses activity-based timeout
 * that resets whenever the CLI produces output (stdout or stderr).
 *
 * The prompt is passed as a CLI positional argument. If `options.input` is
 * provided (e.g. a git diff), it is sent via stdin. Otherwise stdin is closed
 * immediately to avoid the CLI waiting for input that never arrives.
 */
export async function runPrompt(prompt: string, options?: RunPromptOptions): Promise<string> {
  const args = buildCliArgs(prompt, options);
  const env = buildCliEnv();
  const hasInput = !!options?.input;

  return new Promise<string>((resolve, reject) => {
    let settled = false;
    const settle = (fn: () => void) => { if (!settled) { settled = true; fn(); } };

    const proc = spawn(cliPath, args, {
      env,
      cwd: options?.cwd,
      stdio: [hasInput ? 'pipe' : 'ignore', 'pipe', 'pipe'],
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
        const detail = stderr.trim() ? ` stderr: ${stderr.trim().slice(0, 200)}` : '';
        settle(() => reject(new Error(`Claude CLI timed out (no output for ${Math.round(timeout / 1000)}s)${detail}`)));
      }, timeout);
    };
    resetTimer();

    // Hard timeout: absolute deadline that kills the process regardless of activity
    let hardTimer: NodeJS.Timeout | undefined;
    if (options?.hardTimeout) {
      hardTimer = setTimeout(() => {
        proc.kill();
        const detail = stderr.trim() ? ` stderr: ${stderr.trim().slice(0, 200)}` : '';
        settle(() => reject(new Error(`Claude CLI exceeded hard timeout (${Math.round(options.hardTimeout! / 1000)}s)${detail}`)));
      }, options.hardTimeout);
    }

    const cleanup = () => { clearTimeout(timer); if (hardTimer) clearTimeout(hardTimer); };

    proc.stdout!.on('data', (data: Buffer) => { stdout += data.toString(); resetTimer(); });
    proc.stderr!.on('data', (data: Buffer) => { stderr += data.toString(); resetTimer(); });
    proc.on('close', (code) => {
      cleanup();
      if (code === 0) {
        settle(() => resolve(stdout.trim()));
      } else {
        settle(() => reject(new Error(stderr.trim() || `Claude CLI exited with code ${code}`)));
      }
    });
    proc.on('error', (err) => {
      cleanup();
      settle(() => reject(err));
    });

    // Send input via stdin only when provided (e.g. git diff); use single
    // end(data) call to avoid Windows buffering issues with write()+end().
    if (hasInput && proc.stdin) {
      proc.stdin.end(options!.input);
    }
  });
}

/**
 * Stream a prompt response chunk-by-chunk via async generator.
 * Each yield is a text fragment from stdout as it arrives.
 * Uses activity-based timeout that resets on each chunk.
 */
export async function* streamPrompt(prompt: string, options?: RunPromptOptions): AsyncGenerator<string> {
  const args = buildCliArgs(prompt, options);
  const env = buildCliEnv();
  const hasInput = !!options?.input;

  const proc = spawn(cliPath, args, {
    env,
    cwd: options?.cwd,
    stdio: [hasInput ? 'pipe' : 'ignore', 'pipe', 'pipe'],
    windowsHide: true,
  });

  // Send input via stdin only when provided
  if (hasInput && proc.stdin) {
    proc.stdin.end(options!.input);
  }

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
  proc.stderr!.on('data', (data: Buffer) => {
    stderr += data.toString();
    resetTimer();
  });

  try {
    // Node readable streams are async iterable — yields Buffer chunks as they arrive
    for await (const chunk of proc.stdout!) {
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
