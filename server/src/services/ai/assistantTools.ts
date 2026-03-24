import { readdir, stat, readFile, writeFile, mkdir, rm, rename } from 'fs/promises';
import { join, resolve, extname, sep, dirname, relative } from 'path';
import { getProjects } from '../projectDiscovery.js';
import * as gitService from '../gitService.js';
import * as log from '../logService.js';

const MAX_FILE_SIZE = 2 * 1024 * 1024; // 2MB

const IGNORE_NAMES = new Set([
  '.git', 'node_modules', '__pycache__', '.next', 'dist', 'build',
  '.cache', 'vendor', '.turbo', '.nuxt', '.output', 'coverage',
  '.parcel-cache', '.svelte-kit',
]);

const VISIBLE_DOTFILES = new Set([
  '.env', '.env.local', '.env.example', '.env.development', '.env.production',
  '.env.staging', '.env.test', '.env.sample', '.env.defaults', '.env.template',
  '.gitignore', '.gitattributes', '.gitmodules',
  '.dockerignore', '.docker',
  '.editorconfig',
  '.prettierrc', '.prettierignore',
  '.eslintrc', '.eslintignore',
  '.babelrc',
  '.npmrc', '.nvmrc', '.npmignore',
  '.yarnrc',
  '.browserslistrc',
  '.stylelintrc',
  '.huskyrc',
  '.lintstagedrc',
]);

function isVisibleDotfile(name: string): boolean {
  if (VISIBLE_DOTFILES.has(name)) return true;
  if (name.startsWith('.env.')) return true;
  return false;
}

const IMAGE_TYPES: Record<string, string> = {
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.gif': 'image/gif', '.svg': 'image/svg+xml', '.webp': 'image/webp',
  '.ico': 'image/x-icon', '.bmp': 'image/bmp',
};

const TEXT_EXTENSIONS = new Set([
  '.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs',
  '.json', '.jsonc', '.json5',
  '.md', '.mdx', '.markdown',
  '.css', '.scss', '.sass', '.less', '.styl',
  '.html', '.htm', '.xml', '.svg',
  '.yaml', '.yml', '.toml', '.ini', '.cfg', '.conf',
  '.sh', '.bash', '.zsh', '.fish', '.bat', '.cmd', '.ps1',
  '.py', '.rb', '.rs', '.go', '.java', '.kt', '.kts', '.scala',
  '.c', '.cpp', '.h', '.hpp', '.cs', '.swift', '.m',
  '.sql', '.graphql', '.gql',
  '.env', '.env.local', '.env.example', '.gitignore', '.gitattributes',
  '.dockerignore', '.editorconfig', '.prettierrc', '.eslintrc',
  '.txt', '.log', '.csv', '.tsv',
  '.vue', '.svelte', '.astro',
  '.prisma', '.proto',
  '.lock',
]);

function getMimeHint(ext: string, name: string): string {
  if (IMAGE_TYPES[ext]) return IMAGE_TYPES[ext];
  if (ext === '.md' || ext === '.mdx' || ext === '.markdown') return 'text/markdown';
  if (ext === '.json' || ext === '.jsonc') return 'application/json';
  if (TEXT_EXTENSIONS.has(ext)) return 'text/plain';
  if (name.startsWith('.env')) return 'text/plain';
  const textNames = new Set([
    'Makefile', 'Dockerfile', 'Procfile', 'Gemfile', 'Rakefile',
    'LICENSE', 'CHANGELOG', 'README', 'CLAUDE',
    '.gitignore', '.gitattributes', '.gitmodules', '.dockerignore',
    '.editorconfig', '.prettierrc', '.prettierignore',
    '.eslintrc', '.eslintignore', '.babelrc',
    '.npmrc', '.nvmrc', '.npmignore', '.yarnrc',
    '.browserslistrc', '.stylelintrc', '.huskyrc', '.lintstagedrc',
  ]);
  if (textNames.has(name)) return 'text/plain';
  return 'application/octet-stream';
}

async function getProjectPath(projectId: string): Promise<string | null> {
  const projects = await getProjects();
  const project = projects.find(p => p.id === projectId);
  return project?.path || null;
}

function validatePath(projectPath: string, relPath: string, projectId?: string): string {
  const resolved = resolve(join(projectPath, relPath));
  const projectRoot = resolve(projectPath);
  if (!resolved.startsWith(projectRoot + sep) && resolved !== projectRoot) {
    log.warn('files', 'Path traversal attempt blocked', `${relPath} → ${resolved}`, projectId);
    throw new Error('Path traversal detected');
  }
  return resolved;
}

export type AssistantToolResult = { ok: boolean; data?: any; error?: string };

export const ASSISTANT_TOOLS = [
  {
    name: 'list_files',
    description: 'List directory entries for the project. Use path "" for project root.',
    inputSchema: { type: 'object' as const, properties: { path: { type: 'string' } }, required: [] as string[] },
  },
  {
    name: 'search_files',
    description: 'Search file and folder names in the project by substring.',
    inputSchema: { type: 'object' as const, properties: { query: { type: 'string' } }, required: ['query'] },
  },
  {
    name: 'search_content',
    description: 'Search file contents in the project for a text query (small text files only).',
    inputSchema: { type: 'object' as const, properties: { query: { type: 'string' } }, required: ['query'] },
  },
  {
    name: 'read_file',
    description: 'Read a text file from the project.',
    inputSchema: { type: 'object' as const, properties: { path: { type: 'string' } }, required: ['path'] },
  },
  {
    name: 'write_file',
    description: 'Write full content to a text file (creates file if missing).',
    inputSchema: { type: 'object' as const, properties: { path: { type: 'string' }, content: { type: 'string' } }, required: ['path', 'content'] },
  },
  {
    name: 'rename_file',
    description: 'Rename a file or folder (path + newName).',
    inputSchema: { type: 'object' as const, properties: { path: { type: 'string' }, newName: { type: 'string' } }, required: ['path', 'newName'] },
  },
  {
    name: 'delete_file',
    description: 'Delete a file or folder (recursive for folders).',
    inputSchema: { type: 'object' as const, properties: { path: { type: 'string' } }, required: ['path'] },
  },
  {
    name: 'get_git_status',
    description: 'Get compact git status for the project.',
    inputSchema: { type: 'object' as const, properties: {}, required: [] as string[] },
  },
  {
    name: 'get_git_diff',
    description: 'Get git diff. Optional file and staged flag.',
    inputSchema: { type: 'object' as const, properties: { file: { type: 'string' }, staged: { type: 'boolean' } }, required: [] as string[] },
  },
  {
    name: 'stage_file',
    description: 'Stage a single file (git add).',
    inputSchema: { type: 'object' as const, properties: { file: { type: 'string' } }, required: ['file'] },
  },
  {
    name: 'unstage_file',
    description: 'Unstage a single file (git reset).',
    inputSchema: { type: 'object' as const, properties: { file: { type: 'string' } }, required: ['file'] },
  },
  {
    name: 'stage_all',
    description: 'Stage all changes (git add -A).',
    inputSchema: { type: 'object' as const, properties: {}, required: [] as string[] },
  },
  {
    name: 'unstage_all',
    description: 'Unstage all changes (git reset HEAD).',
    inputSchema: { type: 'object' as const, properties: {}, required: [] as string[] },
  },
  {
    name: 'git_commit',
    description: 'Create a git commit with a message.',
    inputSchema: { type: 'object' as const, properties: { message: { type: 'string' } }, required: ['message'] },
  },
  {
    name: 'open_file',
    description: 'Open a file in the Shipyard editor.',
    inputSchema: { type: 'object' as const, properties: { path: { type: 'string' } }, required: ['path'] },
  },
];

export async function listFiles(projectId: string, relPath = ''): Promise<AssistantToolResult> {
  const projectPath = await getProjectPath(projectId);
  if (!projectPath) return { ok: false, error: 'Project not found' };

  let targetPath: string;
  try {
    targetPath = validatePath(projectPath, relPath, projectId);
  } catch (err: any) {
    return { ok: false, error: err.message };
  }

  try {
    const entries = await readdir(targetPath, { withFileTypes: true });
    const result: Array<{ name: string; path: string; type: 'file' | 'dir'; size?: number; extension?: string; mimeHint?: string }> = [];

    for (const entry of entries) {
      if (IGNORE_NAMES.has(entry.name)) continue;
      if (entry.name.startsWith('.') && !isVisibleDotfile(entry.name)) continue;

      const entryRelPath = relPath ? `${relPath}/${entry.name}` : entry.name;

      if (entry.isDirectory()) {
        result.push({ name: entry.name, path: entryRelPath, type: 'dir' });
      } else if (entry.isFile()) {
        const ext = extname(entry.name).toLowerCase();
        try {
          const st = await stat(join(targetPath, entry.name));
          result.push({
            name: entry.name,
            path: entryRelPath,
            type: 'file',
            size: st.size,
            extension: ext || undefined,
            mimeHint: getMimeHint(ext, entry.name),
          });
        } catch {
          // Skip files we can't stat
        }
      }
    }

    result.sort((a, b) => {
      if (a.type !== b.type) return a.type === 'dir' ? -1 : 1;
      return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
    });

    return { ok: true, data: { entries: result } };
  } catch (err: any) {
    return { ok: false, error: err.message };
  }
}

export async function readFileContent(projectId: string, relPath: string): Promise<AssistantToolResult> {
  const projectPath = await getProjectPath(projectId);
  if (!projectPath) return { ok: false, error: 'Project not found' };
  if (!relPath) return { ok: false, error: 'path is required' };

  let targetPath: string;
  try {
    targetPath = validatePath(projectPath, relPath, projectId);
  } catch (err: any) {
    return { ok: false, error: err.message };
  }

  try {
    const st = await stat(targetPath);
    if (!st.isFile()) return { ok: false, error: 'Not a file' };
    if (st.size > MAX_FILE_SIZE) return { ok: false, error: 'File too large (max 2MB)' };

    const ext = extname(targetPath).toLowerCase();
    const name = targetPath.split(/[/\\]/).pop() || '';
    const mimeHint = getMimeHint(ext, name);

    if (mimeHint === 'application/octet-stream' || IMAGE_TYPES[ext]) {
      return { ok: false, error: 'Binary files are not supported' };
    }

    const content = await readFile(targetPath, 'utf8');
    return { ok: true, data: { content, size: st.size, mimeHint } };
  } catch (err: any) {
    return { ok: false, error: err.message };
  }
}

export async function writeFileContent(projectId: string, relPath: string, content: string): Promise<AssistantToolResult> {
  const projectPath = await getProjectPath(projectId);
  if (!projectPath) return { ok: false, error: 'Project not found' };
  if (!relPath) return { ok: false, error: 'path is required' };
  if (typeof content !== 'string') return { ok: false, error: 'content must be a string' };

  let targetPath: string;
  try {
    targetPath = validatePath(projectPath, relPath, projectId);
  } catch (err: any) {
    return { ok: false, error: err.message };
  }

  const ext = extname(targetPath).toLowerCase();
  const name = targetPath.split(/[/\\]/).pop() || '';
  const mimeHint = getMimeHint(ext, name);

  if (mimeHint === 'application/octet-stream' || IMAGE_TYPES[ext]) {
    return { ok: false, error: 'Cannot write binary files' };
  }

  if (Buffer.byteLength(content, 'utf8') > MAX_FILE_SIZE) {
    return { ok: false, error: 'Content too large (max 2MB)' };
  }

  try {
    await mkdir(dirname(targetPath), { recursive: true });
    await writeFile(targetPath, content, 'utf8');
    const newStat = await stat(targetPath);
    return { ok: true, data: { success: true, size: newStat.size } };
  } catch (err: any) {
    return { ok: false, error: err.message };
  }
}

export async function openFile(projectId: string, relPath: string): Promise<AssistantToolResult> {
  const projectPath = await getProjectPath(projectId);
  if (!projectPath) return { ok: false, error: 'Project not found' };
  if (!relPath) return { ok: false, error: 'path is required' };

  let targetPath: string;
  try {
    targetPath = validatePath(projectPath, relPath, projectId);
  } catch (err: any) {
    return { ok: false, error: err.message };
  }

  try {
    const st = await stat(targetPath);
    if (!st.isFile()) return { ok: false, error: 'Not a file' };
    const name = relPath.split('/').pop() || relPath.split('\\').pop() || relPath;
    const extension = extname(name).toLowerCase().replace('.', '');
    return { ok: true, data: { path: relPath, name, extension } };
  } catch (err: any) {
    return { ok: false, error: err.message };
  }
}

export async function renamePath(projectId: string, relPath: string, newName: string): Promise<AssistantToolResult> {
  const projectPath = await getProjectPath(projectId);
  if (!projectPath) return { ok: false, error: 'Project not found' };
  if (!relPath) return { ok: false, error: 'path is required' };
  if (!newName || !newName.trim()) return { ok: false, error: 'newName is required' };

  const trimmedName = newName.trim();
  if (trimmedName.includes('/') || trimmedName.includes('\\') || trimmedName === '.' || trimmedName === '..') {
    return { ok: false, error: 'Invalid newName' };
  }

  let targetPath: string;
  try {
    targetPath = validatePath(projectPath, relPath, projectId);
  } catch (err: any) {
    return { ok: false, error: err.message };
  }

  const parentDir = dirname(targetPath);
  const newPath = join(parentDir, trimmedName);

  try {
    validatePath(projectPath, relative(projectPath, newPath).replace(/\\/g, '/'), projectId);
  } catch (err: any) {
    return { ok: false, error: err.message };
  }

  try {
    await stat(targetPath);
    try {
      await stat(newPath);
      return { ok: false, error: 'A file or folder with that name already exists' };
    } catch (err: any) {
      if (err.code !== 'ENOENT') throw err;
    }
    await rename(targetPath, newPath);
    const newRelPath = relative(projectPath, newPath).replace(/\\/g, '/');
    return { ok: true, data: { success: true, newPath: newRelPath } };
  } catch (err: any) {
    return { ok: false, error: err.message };
  }
}

export async function deletePath(projectId: string, relPath: string): Promise<AssistantToolResult> {
  const projectPath = await getProjectPath(projectId);
  if (!projectPath) return { ok: false, error: 'Project not found' };
  if (!relPath) return { ok: false, error: 'path is required' };

  let targetPath: string;
  try {
    targetPath = validatePath(projectPath, relPath, projectId);
  } catch (err: any) {
    return { ok: false, error: err.message };
  }

  if (resolve(targetPath) === resolve(projectPath)) {
    return { ok: false, error: 'Cannot delete project root' };
  }

  try {
    const st = await stat(targetPath);
    if (st.isDirectory()) {
      await rm(targetPath, { recursive: true, force: true });
    } else {
      await rm(targetPath, { force: true });
    }
    return { ok: true, data: { success: true } };
  } catch (err: any) {
    return { ok: false, error: err.message };
  }
}

export async function searchFiles(projectId: string, query: string): Promise<AssistantToolResult> {
  const projectPath = await getProjectPath(projectId);
  if (!projectPath) return { ok: false, error: 'Project not found' };
  const q = (query || '').trim().toLowerCase();
  if (q.length < 2) return { ok: true, data: { results: [] } };

  const results: Array<{ name: string; path: string; type: 'file' | 'dir' }> = [];
  const MAX_RESULTS = 50;
  const MAX_DEPTH = 5;

  async function walk(dirPath: string, relPath: string, depth: number) {
    if (depth > MAX_DEPTH || results.length >= MAX_RESULTS) return;
    const entries = await readdir(dirPath, { withFileTypes: true }).catch(() => []);
    for (const entry of entries) {
      if (results.length >= MAX_RESULTS) break;
      if (IGNORE_NAMES.has(entry.name)) continue;
      if (entry.name.startsWith('.') && !isVisibleDotfile(entry.name)) continue;

      const entryRelPath = relPath ? `${relPath}/${entry.name}` : entry.name;
      if (entry.name.toLowerCase().includes(q)) {
        results.push({ name: entry.name, path: entryRelPath, type: entry.isDirectory() ? 'dir' : 'file' });
      }

      if (entry.isDirectory()) {
        await walk(join(dirPath, entry.name), entryRelPath, depth + 1);
      }
    }
  }

  await walk(projectPath, '', 0);
  return { ok: true, data: { results } };
}

export async function searchContent(projectId: string, query: string): Promise<AssistantToolResult> {
  const projectPath = await getProjectPath(projectId);
  if (!projectPath) return { ok: false, error: 'Project not found' };
  const q = (query || '').trim();
  if (q.length < 2) return { ok: true, data: { results: [] } };

  const results: Array<{ filePath: string; line: number; text: string }> = [];
  const MAX_RESULTS = 50;
  const MAX_DEPTH = 6;
  const MAX_FILE_SIZE_SEARCH = 512 * 1024;

  const escaped = q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const searchRegex = new RegExp(escaped, 'i');

  async function walk(dirPath: string, relPath: string, depth: number) {
    if (depth > MAX_DEPTH || results.length >= MAX_RESULTS) return;
    const entries = await readdir(dirPath, { withFileTypes: true }).catch(() => []);
    for (const entry of entries) {
      if (results.length >= MAX_RESULTS) break;
      if (IGNORE_NAMES.has(entry.name)) continue;
      if (entry.name.startsWith('.') && !isVisibleDotfile(entry.name)) continue;

      const entryRelPath = relPath ? `${relPath}/${entry.name}` : entry.name;

      if (entry.isDirectory()) {
        await walk(join(dirPath, entry.name), entryRelPath, depth + 1);
      } else if (entry.isFile()) {
        const ext = extname(entry.name).toLowerCase();
        if (!TEXT_EXTENSIONS.has(ext) && !entry.name.startsWith('.env')) continue;

        try {
          const filePath = join(dirPath, entry.name);
          const st = await stat(filePath);
          if (st.size > MAX_FILE_SIZE_SEARCH || st.size === 0) continue;

          const content = await readFile(filePath, 'utf8');
          const lines = content.split('\n');
          for (let i = 0; i < lines.length; i++) {
            if (results.length >= MAX_RESULTS) break;
            if (searchRegex.test(lines[i])) {
              results.push({ filePath: entryRelPath, line: i + 1, text: lines[i].trimEnd() });
            }
          }
        } catch {
          // ignore unreadable
        }
      }
    }
  }

  await walk(projectPath, '', 0);
  return { ok: true, data: { results } };
}

export async function getGitStatus(projectId: string): Promise<AssistantToolResult> {
  const projectPath = await getProjectPath(projectId);
  if (!projectPath) return { ok: false, error: 'Project not found' };
  try {
    const s = await gitService.getStatus(projectPath);
    const summary = {
      branch: s.current,
      tracking: s.tracking || null,
      ahead: s.ahead,
      behind: s.behind,
      staged: s.staged.length > 0 ? s.staged : undefined,
      modified: s.modified.length > 0 ? s.modified : undefined,
      not_added: s.not_added.length > 0 ? s.not_added : undefined,
      created: s.created.length > 0 ? s.created : undefined,
      deleted: s.deleted.length > 0 ? s.deleted : undefined,
      conflicted: s.conflicted.length > 0 ? s.conflicted : undefined,
      isClean: s.isClean(),
    };
    return { ok: true, data: summary };
  } catch (err: any) {
    return { ok: false, error: err.message };
  }
}

export async function getGitDiff(projectId: string, file?: string, staged = false): Promise<AssistantToolResult> {
  const projectPath = await getProjectPath(projectId);
  if (!projectPath) return { ok: false, error: 'Project not found' };
  try {
    const diff = await gitService.getDiff(projectPath, file, staged);
    return { ok: true, data: { diff } };
  } catch (err: any) {
    return { ok: false, error: err.message };
  }
}

export async function stageFile(projectId: string, file: string): Promise<AssistantToolResult> {
  const projectPath = await getProjectPath(projectId);
  if (!projectPath) return { ok: false, error: 'Project not found' };
  if (!file) return { ok: false, error: 'file is required' };
  try {
    await gitService.stageFile(projectPath, file);
    return { ok: true, data: { success: true } };
  } catch (err: any) {
    return { ok: false, error: err.message };
  }
}

export async function unstageFile(projectId: string, file: string): Promise<AssistantToolResult> {
  const projectPath = await getProjectPath(projectId);
  if (!projectPath) return { ok: false, error: 'Project not found' };
  if (!file) return { ok: false, error: 'file is required' };
  try {
    await gitService.unstageFile(projectPath, file);
    return { ok: true, data: { success: true } };
  } catch (err: any) {
    return { ok: false, error: err.message };
  }
}

export async function stageAll(projectId: string): Promise<AssistantToolResult> {
  const projectPath = await getProjectPath(projectId);
  if (!projectPath) return { ok: false, error: 'Project not found' };
  try {
    await gitService.stageAll(projectPath);
    return { ok: true, data: { success: true } };
  } catch (err: any) {
    return { ok: false, error: err.message };
  }
}

export async function unstageAll(projectId: string): Promise<AssistantToolResult> {
  const projectPath = await getProjectPath(projectId);
  if (!projectPath) return { ok: false, error: 'Project not found' };
  try {
    await gitService.unstageAll(projectPath);
    return { ok: true, data: { success: true } };
  } catch (err: any) {
    return { ok: false, error: err.message };
  }
}

export async function gitCommit(projectId: string, message: string): Promise<AssistantToolResult> {
  const projectPath = await getProjectPath(projectId);
  if (!projectPath) return { ok: false, error: 'Project not found' };
  if (!message || !message.trim()) return { ok: false, error: 'message is required' };
  try {
    const hash = await gitService.commit(projectPath, message.trim());
    return { ok: true, data: { commit: hash } };
  } catch (err: any) {
    return { ok: false, error: err.message };
  }
}

export async function getWritePreview(projectId: string, relPath: string, content: string): Promise<AssistantToolResult> {
  const current = await readFileContent(projectId, relPath);
  if (!current.ok) {
    // treat as new file
    const preview = buildPreview('', content, relPath);
    return { ok: true, data: { preview } };
  }
  const preview = buildPreview(current.data?.content || '', content, relPath);
  return { ok: true, data: { preview } };
}

function buildPreview(oldContent: string, newContent: string, relPath: string): string {
  if (oldContent === newContent) return `No changes for ${relPath}`;
  const oldLines = oldContent.split('\n');
  const newLines = newContent.split('\n');

  const maxLines = 400;
  const maxMatrixCells = 4_000_000;
  if (oldLines.length * newLines.length > maxMatrixCells || oldLines.length > 2000 || newLines.length > 2000) {
    return buildSingleHunkPreview(oldLines, newLines, relPath, maxLines);
  }

  const ops = diffLines(oldLines, newLines);
  const hunks = buildHunks(ops, 3);

  const out: string[] = [`--- a/${relPath}`, `+++ b/${relPath}`];
  for (const h of hunks) {
    out.push(`@@ -${h.oldStart},${h.oldCount} +${h.newStart},${h.newCount} @@`);
    out.push(...h.lines);
  }

  if (out.length > maxLines) {
    return out.slice(0, maxLines).concat(['...', `... ${out.length - maxLines} more lines`]).join('\n');
  }
  return out.join('\n');
}

function buildSingleHunkPreview(oldLines: string[], newLines: string[], relPath: string, maxLines: number): string {
  let prefix = 0;
  while (prefix < oldLines.length && prefix < newLines.length && oldLines[prefix] === newLines[prefix]) prefix++;
  let suffix = 0;
  while (
    suffix < (oldLines.length - prefix) &&
    suffix < (newLines.length - prefix) &&
    oldLines[oldLines.length - 1 - suffix] === newLines[newLines.length - 1 - suffix]
  ) {
    suffix++;
  }
  const removed = oldLines.slice(prefix, oldLines.length - suffix);
  const added = newLines.slice(prefix, newLines.length - suffix);
  const header = [
    `--- a/${relPath}`,
    `+++ b/${relPath}`,
    `@@ -${prefix + 1},${removed.length} +${prefix + 1},${added.length} @@`,
  ];
  const body: string[] = [];
  for (const line of removed) body.push(`-${line}`);
  for (const line of added) body.push(`+${line}`);
  const all = header.concat(body);
  if (all.length > maxLines) {
    return all.slice(0, maxLines).concat(['...', `... ${all.length - maxLines} more lines`]).join('\n');
  }
  return all.join('\n');
}

type DiffOp = { type: 'equal' | 'add' | 'del'; line: string };

function diffLines(oldLines: string[], newLines: string[]): DiffOp[] {
  const n = oldLines.length;
  const m = newLines.length;
  const dp: number[][] = Array.from({ length: n + 1 }, () => new Array<number>(m + 1).fill(0));

  for (let i = 1; i <= n; i++) {
    for (let j = 1; j <= m; j++) {
      if (oldLines[i - 1] === newLines[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1] + 1;
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
      }
    }
  }

  const ops: DiffOp[] = [];
  let i = n;
  let j = m;
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && oldLines[i - 1] === newLines[j - 1]) {
      ops.push({ type: 'equal', line: oldLines[i - 1] });
      i--; j--;
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      ops.push({ type: 'add', line: newLines[j - 1] });
      j--;
    } else if (i > 0) {
      ops.push({ type: 'del', line: oldLines[i - 1] });
      i--;
    }
  }
  return ops.reverse();
}

function buildHunks(ops: DiffOp[], context: number) {
  const hunks: Array<{ oldStart: number; newStart: number; oldCount: number; newCount: number; lines: string[] }> = [];
  let oldLine = 1;
  let newLine = 1;

  let hunk: { oldStart: number; newStart: number; oldCount: number; newCount: number; lines: string[] } | null = null;
  let preContext: DiffOp[] = [];
  let contextAfter = 0;

  const pushContext = (op: DiffOp) => {
    preContext.push(op);
    if (preContext.length > context) preContext.shift();
  };

  const startHunk = () => {
    const oldStart = oldLine - preContext.length;
    const newStart = newLine - preContext.length;
    hunk = { oldStart, newStart, oldCount: 0, newCount: 0, lines: [] };
    for (const ctx of preContext) {
      hunk.lines.push(` ${ctx.line}`);
      hunk.oldCount++;
      hunk.newCount++;
    }
    preContext = [];
  };

  const closeHunk = () => {
    if (!hunk) return;
    hunks.push(hunk);
    hunk = null;
    contextAfter = 0;
  };

  for (const op of ops) {
    if (op.type === 'equal') {
      if (hunk) {
        hunk.lines.push(` ${op.line}`);
        hunk.oldCount++;
        hunk.newCount++;
        contextAfter++;
        if (contextAfter >= context) {
          pushContext(op);
          closeHunk();
        }
      } else {
        pushContext(op);
      }
      oldLine++;
      newLine++;
    } else {
      if (!hunk) startHunk();
      contextAfter = 0;
      if (op.type === 'del') {
        hunk!.lines.push(`-${op.line}`);
        hunk!.oldCount++;
        oldLine++;
      } else {
        hunk!.lines.push(`+${op.line}`);
        hunk!.newCount++;
        newLine++;
      }
    }
  }

  if (hunk) {
    closeHunk();
  }
  return hunks;
}

export async function runAssistantTool(name: string, args: Record<string, any>, projectId: string): Promise<AssistantToolResult> {
  switch (name) {
    case 'list_files':
      return listFiles(projectId, args.path || '');
    case 'search_files':
      return searchFiles(projectId, args.query || '');
    case 'search_content':
      return searchContent(projectId, args.query || '');
    case 'read_file':
      return readFileContent(projectId, args.path);
    case 'write_file':
      return writeFileContent(projectId, args.path, args.content);
    case 'rename_file':
      return renamePath(projectId, args.path, args.newName);
    case 'delete_file':
      return deletePath(projectId, args.path);
    case 'get_git_status':
      return getGitStatus(projectId);
    case 'get_git_diff':
      return getGitDiff(projectId, args.file, !!args.staged);
    case 'stage_file':
      return stageFile(projectId, args.file);
    case 'unstage_file':
      return unstageFile(projectId, args.file);
    case 'stage_all':
      return stageAll(projectId);
    case 'unstage_all':
      return unstageAll(projectId);
    case 'git_commit':
      return gitCommit(projectId, args.message);
    case 'open_file':
      return openFile(projectId, args.path);
    default:
      return { ok: false, error: `Unknown tool: ${name}` };
  }
}

export async function runAssistantToolCalls(projectId: string, toolCalls: Array<{ name: string; args: Record<string, any> }>) {
  const results = [];
  for (const call of toolCalls) {
    const result = await runAssistantTool(call.name, call.args || {}, projectId);
    results.push({
      name: call.name,
      args: call.args || {},
      ok: result.ok,
      result: result.ok ? result.data : undefined,
      error: result.ok ? undefined : result.error,
    });
  }
  return results;
}
