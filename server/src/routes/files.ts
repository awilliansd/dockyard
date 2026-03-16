import { FastifyInstance } from 'fastify';
import { readdir, stat, readFile, writeFile, unlink, rm } from 'fs/promises';
import { join, resolve, extname, relative, sep } from 'path';
import { getProjects } from '../services/projectDiscovery.js';
import { openFolder } from '../services/terminalLauncher.js';

const MAX_FILE_SIZE = 2 * 1024 * 1024; // 2MB

const IGNORE_NAMES = new Set([
  '.git', 'node_modules', '__pycache__', '.next', 'dist', 'build',
  '.cache', 'vendor', '.turbo', '.nuxt', '.output', 'coverage',
  '.parcel-cache', '.svelte-kit',
]);

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
  '.lock', // package-lock, yarn.lock etc
]);

function getMimeHint(ext: string, name: string): string {
  if (IMAGE_TYPES[ext]) return IMAGE_TYPES[ext];
  if (ext === '.md' || ext === '.mdx' || ext === '.markdown') return 'text/markdown';
  if (ext === '.json' || ext === '.jsonc') return 'application/json';
  if (TEXT_EXTENSIONS.has(ext)) return 'text/plain';
  // Files without extension that are likely text
  const textNames = new Set([
    'Makefile', 'Dockerfile', 'Procfile', 'Gemfile', 'Rakefile',
    'LICENSE', 'CHANGELOG', 'README', 'CLAUDE',
    '.gitignore', '.gitattributes', '.dockerignore', '.editorconfig',
    '.prettierrc', '.eslintrc', '.babelrc',
  ]);
  if (textNames.has(name)) return 'text/plain';
  return 'application/octet-stream';
}

async function getProjectPath(projectId: string): Promise<string | null> {
  const projects = await getProjects();
  const project = projects.find(p => p.id === projectId);
  return project?.path || null;
}

function validatePath(projectPath: string, relPath: string): string {
  const resolved = resolve(join(projectPath, relPath));
  const projectRoot = resolve(projectPath);
  if (!resolved.startsWith(projectRoot + sep) && resolved !== projectRoot) {
    throw { statusCode: 403, message: 'Path traversal detected' };
  }
  return resolved;
}

export interface FileEntry {
  name: string;
  path: string; // relative to project root
  type: 'file' | 'dir';
  size?: number;
  extension?: string;
  mimeHint?: string;
}

export async function fileRoutes(app: FastifyInstance) {
  // List directory contents
  app.get<{ Params: { projectId: string }; Querystring: { path?: string } }>(
    '/api/projects/:projectId/files/tree',
    async (request, reply) => {
      const projectPath = await getProjectPath(request.params.projectId);
      if (!projectPath) return reply.status(404).send({ error: 'Project not found' });

      const relPath = request.query.path || '';
      let targetPath: string;
      try {
        targetPath = validatePath(projectPath, relPath);
      } catch (e: any) {
        return reply.status(e.statusCode || 400).send({ error: e.message });
      }

      try {
        const entries = await readdir(targetPath, { withFileTypes: true });
        const result: FileEntry[] = [];

        for (const entry of entries) {
          if (IGNORE_NAMES.has(entry.name)) continue;
          if (entry.name.startsWith('.') && entry.name !== '.env.example') continue;

          const entryRelPath = relPath ? `${relPath}/${entry.name}` : entry.name;

          if (entry.isDirectory()) {
            result.push({
              name: entry.name,
              path: entryRelPath,
              type: 'dir',
            });
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

        // Sort: dirs first, then files, alphabetical within each group
        result.sort((a, b) => {
          if (a.type !== b.type) return a.type === 'dir' ? -1 : 1;
          return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
        });

        return { entries: result };
      } catch (err: any) {
        return reply.status(500).send({ error: err.message });
      }
    }
  );

  // Read file content
  app.get<{ Params: { projectId: string }; Querystring: { path: string } }>(
    '/api/projects/:projectId/files/content',
    async (request, reply) => {
      const projectPath = await getProjectPath(request.params.projectId);
      if (!projectPath) return reply.status(404).send({ error: 'Project not found' });

      const relPath = request.query.path;
      if (!relPath) return reply.status(400).send({ error: 'path query parameter required' });

      let targetPath: string;
      try {
        targetPath = validatePath(projectPath, relPath);
      } catch (e: any) {
        return reply.status(e.statusCode || 400).send({ error: e.message });
      }

      try {
        const st = await stat(targetPath);
        if (!st.isFile()) return reply.status(400).send({ error: 'Not a file' });

        const ext = extname(targetPath).toLowerCase();
        const name = targetPath.split(/[/\\]/).pop() || '';
        const mimeHint = getMimeHint(ext, name);
        const isImage = !!IMAGE_TYPES[ext];

        // For raw image requests (no Accept: application/json), return binary
        const acceptsJson = request.headers.accept?.includes('application/json');
        if (isImage && !acceptsJson) {
          if (st.size > MAX_FILE_SIZE) {
            return reply.status(413).send({ error: 'File too large' });
          }
          const buffer = await readFile(targetPath);
          return reply.header('Content-Type', mimeHint).send(buffer);
        }

        // JSON envelope for preview
        if (st.size > MAX_FILE_SIZE) {
          return { content: '', encoding: 'utf8', mimeHint: 'too-large', size: st.size };
        }

        if (isImage) {
          const buffer = await readFile(targetPath);
          return { content: buffer.toString('base64'), encoding: 'base64', mimeHint, size: st.size };
        }

        // Text content
        const content = await readFile(targetPath, 'utf8');
        return { content, encoding: 'utf8', mimeHint, size: st.size };
      } catch (err: any) {
        return reply.status(500).send({ error: err.message });
      }
    }
  );

  // Delete file or directory
  app.delete<{ Params: { projectId: string }; Querystring: { path: string } }>(
    '/api/projects/:projectId/files',
    async (request, reply) => {
      const projectPath = await getProjectPath(request.params.projectId);
      if (!projectPath) return reply.status(404).send({ error: 'Project not found' });

      const relPath = request.query.path;
      if (!relPath) return reply.status(400).send({ error: 'path query parameter required' });

      let targetPath: string;
      try {
        targetPath = validatePath(projectPath, relPath);
      } catch (e: any) {
        return reply.status(e.statusCode || 400).send({ error: e.message });
      }

      // Prevent deleting project root
      if (resolve(targetPath) === resolve(projectPath)) {
        return reply.status(403).send({ error: 'Cannot delete project root' });
      }

      try {
        const st = await stat(targetPath);
        if (st.isDirectory()) {
          await rm(targetPath, { recursive: true });
        } else {
          await unlink(targetPath);
        }
        return { success: true };
      } catch (err: any) {
        return reply.status(500).send({ error: err.message });
      }
    }
  );

  // Save file content
  app.put<{ Params: { projectId: string }; Body: { path: string; content: string } }>(
    '/api/projects/:projectId/files/content',
    async (request, reply) => {
      const projectPath = await getProjectPath(request.params.projectId);
      if (!projectPath) return reply.status(404).send({ error: 'Project not found' });

      const { path: relPath, content } = request.body || {};
      if (!relPath) return reply.status(400).send({ error: 'path is required' });
      if (typeof content !== 'string') return reply.status(400).send({ error: 'content must be a string' });

      let targetPath: string;
      try {
        targetPath = validatePath(projectPath, relPath);
      } catch (e: any) {
        return reply.status(e.statusCode || 400).send({ error: e.message });
      }

      const ext = extname(targetPath).toLowerCase();
      const name = targetPath.split(/[/\\]/).pop() || '';
      const mimeHint = getMimeHint(ext, name);

      if (mimeHint === 'application/octet-stream' || IMAGE_TYPES[ext]) {
        return reply.status(400).send({ error: 'Cannot write binary files' });
      }

      if (Buffer.byteLength(content, 'utf8') > MAX_FILE_SIZE) {
        return reply.status(413).send({ error: 'Content too large (max 2MB)' });
      }

      try {
        await stat(targetPath); // Verify file exists
        await writeFile(targetPath, content, 'utf8');
        const newStat = await stat(targetPath);
        return { success: true, size: newStat.size };
      } catch (err: any) {
        if (err.code === 'ENOENT') return reply.status(404).send({ error: 'File not found' });
        return reply.status(500).send({ error: err.message });
      }
    }
  );

  // Search files across projects by filename
  app.get<{ Querystring: { q: string; projectId?: string; limit?: string } }>(
    '/api/search/files',
    async (request, reply) => {
      const query = (request.query.q || '').trim().toLowerCase();
      if (!query || query.length < 2) {
        return { results: [] };
      }

      const limit = Math.min(parseInt(request.query.limit || '30', 10), 100);
      const filterProjectId = request.query.projectId;
      const projects = await getProjects();
      const targetProjects = filterProjectId
        ? projects.filter(p => p.id === filterProjectId)
        : projects;

      const results: Array<{
        name: string;
        path: string;
        projectId: string;
        projectName: string;
        type: 'file' | 'dir';
        extension?: string;
      }> = [];

      const MAX_DEPTH = 5;

      async function walkDir(dirPath: string, relPath: string, projectId: string, projectName: string, depth: number) {
        if (depth > MAX_DEPTH || results.length >= limit) return;
        try {
          const entries = await readdir(dirPath, { withFileTypes: true });
          for (const entry of entries) {
            if (results.length >= limit) break;
            if (IGNORE_NAMES.has(entry.name)) continue;
            if (entry.name.startsWith('.') && entry.name !== '.env.example') continue;

            const entryRelPath = relPath ? `${relPath}/${entry.name}` : entry.name;

            if (entry.name.toLowerCase().includes(query)) {
              results.push({
                name: entry.name,
                path: entryRelPath,
                projectId,
                projectName,
                type: entry.isDirectory() ? 'dir' : 'file',
                extension: entry.isFile() ? extname(entry.name).toLowerCase() || undefined : undefined,
              });
            }

            if (entry.isDirectory()) {
              await walkDir(join(dirPath, entry.name), entryRelPath, projectId, projectName, depth + 1);
            }
          }
        } catch {
          // Skip directories we can't read
        }
      }

      await Promise.all(
        targetProjects.map(p => walkDir(p.path, '', p.id, p.name, 0))
      );

      return { results: results.slice(0, limit) };
    }
  );

  // Open folder in system explorer
  app.post<{ Params: { projectId: string }; Body: { path: string } }>(
    '/api/projects/:projectId/files/open-folder',
    async (request, reply) => {
      const projectPath = await getProjectPath(request.params.projectId);
      if (!projectPath) return reply.status(404).send({ error: 'Project not found' });

      const relPath = request.body.path || '';
      let targetPath: string;
      try {
        targetPath = validatePath(projectPath, relPath);
      } catch (e: any) {
        return reply.status(e.statusCode || 400).send({ error: e.message });
      }

      try {
        // If it's a file, open the parent directory
        const st = await stat(targetPath);
        const folderPath = st.isDirectory() ? targetPath : resolve(targetPath, '..');
        await openFolder(folderPath);
        return { success: true };
      } catch (err: any) {
        return reply.status(500).send({ error: err.message });
      }
    }
  );
}
