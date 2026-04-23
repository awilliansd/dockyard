import { FastifyInstance } from 'fastify';
import { getSettings, saveSettings } from '../services/settingsStore.js';
import { TASKS_DIR } from '../services/taskStore.js';
import { readdir, stat } from 'fs/promises';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export async function settingsRoutes(app: FastifyInstance) {
  app.get('/api/version', async () => {
    try {
      const packageJsonPath = join(__dirname, '..', '..', '..', 'package.json');
      const content = readFileSync(packageJsonPath, 'utf-8');
      const pkg = JSON.parse(content);
      return { version: pkg.version || 'unknown' };
    } catch {
      return { version: 'unknown' };
    }
  });

  app.get('/api/settings', async () => {
    return { ...getSettings(), tasksDir: TASKS_DIR };
  });

  app.put<{ Body: { aiAutoCommitEnabled?: boolean; aiCliRuntime?: 'openclaude' | 'codex' | 'gemini' | 'opencode' } }>('/api/settings', async (request) => {
    const current = getSettings();
    const runtime = request.body.aiCliRuntime;
    const isValidRuntime = runtime === 'openclaude' || runtime === 'codex' || runtime === 'gemini' || runtime === 'opencode';
    const next = {
      ...current,
      ...(typeof request.body.aiAutoCommitEnabled === 'boolean'
        ? { aiAutoCommitEnabled: request.body.aiAutoCommitEnabled }
        : {}),
      ...(isValidRuntime ? { aiCliRuntime: runtime } : {}),
    };

    const saved = await saveSettings(next);
    return { ...saved, tasksDir: TASKS_DIR };
  });

  // List subdirectories of a given path (for folder browser)
  app.post<{ Body: { path: string } }>(
    '/api/browse',
    async (request, reply) => {
      const dirPath = request.body.path;
      try {
        const entries = await readdir(dirPath);
        const dirs: { name: string; path: string }[] = [];

        for (const entry of entries) {
          if (entry.startsWith('.') || entry === 'node_modules' || entry === '$Recycle.Bin' || entry === 'System Volume Information' || entry === 'lost+found') continue;
          const fullPath = join(dirPath, entry);
          try {
            const s = await stat(fullPath);
            if (s.isDirectory()) {
              dirs.push({ name: entry, path: fullPath });
            }
          } catch {}
        }

        dirs.sort((a, b) => a.name.localeCompare(b.name));
        return { directories: dirs };
      } catch (err: any) {
        return reply.status(400).send({ error: `Cannot read directory: ${err.message}` });
      }
    }
  );
}
