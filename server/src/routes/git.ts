import { FastifyInstance } from 'fastify';
import { join } from 'path';
import * as gitService from '../services/gitService.js';
import * as ai from '../services/ai/index.js';
import { getProjects } from '../services/projectDiscovery.js';
import * as log from '../services/logService.js';

/**
 * Strip context lines from a git diff, keeping only +/- lines, file headers,
 * and hunk headers. This significantly reduces token count for AI processing.
 */
function compactGitDiff(diff: string, maxLen: number): string {
  const lines = diff.split('\n');
  const kept: string[] = [];
  let totalLen = 0;

  for (const line of lines) {
    // Always keep: diff headers, file names, hunk headers, +/- lines
    if (
      line.startsWith('diff ') ||
      line.startsWith('--- ') ||
      line.startsWith('+++ ') ||
      line.startsWith('@@') ||
      line.startsWith('+') ||
      line.startsWith('-')
    ) {
      if (totalLen + line.length > maxLen) break;
      kept.push(line);
      totalLen += line.length + 1;
    }
  }

  return kept.join('\n');
}

async function getProjectPath(projectId: string, subrepo?: string): Promise<string | null> {
  const projects = await getProjects();
  const project = projects.find(p => p.id === projectId);
  if (!project?.path) return null;
  if (subrepo) {
    // Validate subrepo is in the allowed list
    if (!project.subRepos?.includes(subrepo)) return null;
    return join(project.path, subrepo);
  }
  return project.path;
}

export async function gitRoutes(app: FastifyInstance) {
  // Track last fetch time per project to avoid fetching too often
  const lastFetch = new Map<string, number>();

  app.get<{ Params: { projectId: string }; Querystring: { subrepo?: string } }>(
    '/api/projects/:projectId/git/status',
    async (request, reply) => {
      const path = await getProjectPath(request.params.projectId, request.query.subrepo);
      if (!path) return reply.status(404).send({ error: 'Project not found' });

      try {
        // Fetch at most once per 60s to keep ahead/behind accurate
        const now = Date.now();
        const last = lastFetch.get(path) || 0;
        if (now - last > 60_000) {
          lastFetch.set(path, now);
          await gitService.fetch(path);
        }

        const status = await gitService.getStatus(path);
        return status;
      } catch (err: any) {
        return reply.status(500).send({ error: err.message });
      }
    }
  );

  app.get<{ Params: { projectId: string }; Querystring: { file?: string; staged?: string; subrepo?: string } }>(
    '/api/projects/:projectId/git/diff',
    async (request, reply) => {
      const path = await getProjectPath(request.params.projectId, request.query.subrepo);
      if (!path) return reply.status(404).send({ error: 'Project not found' });

      try {
        const staged = request.query.staged === 'true';
        const diff = await gitService.getDiff(path, request.query.file, staged);
        return { diff };
      } catch (err: any) {
        return reply.status(500).send({ error: err.message });
      }
    }
  );

  app.get<{ Params: { projectId: string }; Querystring: { file: string; ref?: string; subrepo?: string } }>(
    '/api/projects/:projectId/git/show',
    async (request, reply) => {
      const path = await getProjectPath(request.params.projectId, request.query.subrepo);
      if (!path) return reply.status(404).send({ error: 'Project not found' });

      try {
        const content = await gitService.getFileAtRef(path, request.query.file, request.query.ref || 'HEAD');
        return { content };
      } catch (err: any) {
        // File may not exist in HEAD (new file) — various git error messages
        if (err.message?.includes('does not exist') || err.message?.includes('exists on disk') || err.message?.includes('fatal')) {
          return { content: '' };
        }
        return reply.status(500).send({ error: err.message });
      }
    }
  );

  app.post<{ Params: { projectId: string }; Body: { file: string; subrepo?: string } }>(
    '/api/projects/:projectId/git/stage',
    async (request, reply) => {
      const path = await getProjectPath(request.params.projectId, request.body.subrepo);
      if (!path) return reply.status(404).send({ error: 'Project not found' });

      await gitService.stageFile(path, request.body.file);
      return { success: true };
    }
  );

  app.post<{ Params: { projectId: string }; Body: { subrepo?: string } }>(
    '/api/projects/:projectId/git/stage-all',
    async (request, reply) => {
      const path = await getProjectPath(request.params.projectId, (request.body as any)?.subrepo);
      if (!path) return reply.status(404).send({ error: 'Project not found' });

      await gitService.stageAll(path);
      return { success: true };
    }
  );

  app.post<{ Params: { projectId: string }; Body: { file: string; subrepo?: string } }>(
    '/api/projects/:projectId/git/unstage',
    async (request, reply) => {
      const path = await getProjectPath(request.params.projectId, request.body.subrepo);
      if (!path) return reply.status(404).send({ error: 'Project not found' });

      await gitService.unstageFile(path, request.body.file);
      return { success: true };
    }
  );

  app.post<{ Params: { projectId: string }; Body: { subrepo?: string } }>(
    '/api/projects/:projectId/git/unstage-all',
    async (request, reply) => {
      const path = await getProjectPath(request.params.projectId, (request.body as any)?.subrepo);
      if (!path) return reply.status(404).send({ error: 'Project not found' });

      await gitService.unstageAll(path);
      return { success: true };
    }
  );

  app.post<{ Params: { projectId: string }; Body: { message: string; subrepo?: string } }>(
    '/api/projects/:projectId/git/commit',
    async (request, reply) => {
      const path = await getProjectPath(request.params.projectId, request.body.subrepo);
      if (!path) return reply.status(404).send({ error: 'Project not found' });

      try {
        const hash = await gitService.commit(path, request.body.message);
        log.info('git', `Commit created: ${hash}`, request.body.message.substring(0, 100), request.params.projectId);
        return { commit: hash };
      } catch (err: any) {
        log.error('git', `Commit failed`, err.message, request.params.projectId);
        return reply.status(500).send({ error: err.message });
      }
    }
  );

  app.post<{ Params: { projectId: string }; Body: { subrepo?: string } }>(
    '/api/projects/:projectId/git/push',
    async (request, reply) => {
      const path = await getProjectPath(request.params.projectId, (request.body as any)?.subrepo);
      if (!path) return reply.status(404).send({ error: 'Project not found' });

      try {
        await gitService.push(path);
        log.info('git', 'Push completed', undefined, request.params.projectId);
        return { success: true };
      } catch (err: any) {
        log.error('git', 'Push failed', err.message, request.params.projectId);
        return reply.status(500).send({ error: err.message });
      }
    }
  );

  app.post<{ Params: { projectId: string }; Body: { subrepo?: string } }>(
    '/api/projects/:projectId/git/pull',
    async (request, reply) => {
      const path = await getProjectPath(request.params.projectId, (request.body as any)?.subrepo);
      if (!path) return reply.status(404).send({ error: 'Project not found' });

      try {
        await gitService.pull(path);
        log.info('git', 'Pull completed', undefined, request.params.projectId);
        return { success: true };
      } catch (err: any) {
        log.error('git', 'Pull failed', err.message, request.params.projectId);
        return reply.status(500).send({ error: err.message });
      }
    }
  );

  app.get<{ Params: { projectId: string }; Querystring: { subrepo?: string } }>(
    '/api/projects/:projectId/git/log',
    async (request, reply) => {
      const path = await getProjectPath(request.params.projectId, request.query.subrepo);
      if (!path) return reply.status(404).send({ error: 'Project not found' });

      try {
        const log = await gitService.getLog(path);
        return log;
      } catch (err: any) {
        return reply.status(500).send({ error: err.message });
      }
    }
  );

  app.get<{ Params: { projectId: string }; Querystring: { subrepo?: string } }>(
    '/api/projects/:projectId/git/branches',
    async (request, reply) => {
      const path = await getProjectPath(request.params.projectId, request.query.subrepo);
      if (!path) return reply.status(404).send({ error: 'Project not found' });

      try {
        const branches = await gitService.getBranches(path);
        return branches;
      } catch (err: any) {
        return reply.status(500).send({ error: err.message });
      }
    }
  );

  app.post<{ Params: { projectId: string }; Body: { branch: string; subrepo?: string } }>(
    '/api/projects/:projectId/git/checkout',
    async (request, reply) => {
      const path = await getProjectPath(request.params.projectId, request.body.subrepo);
      if (!path) return reply.status(404).send({ error: 'Project not found' });

      const { branch } = request.body;
      if (!branch || typeof branch !== 'string') {
        return reply.status(400).send({ error: 'Branch name is required' });
      }

      try {
        await gitService.checkoutBranch(path, branch);
        log.info('git', `Switched to branch: ${branch}`, undefined, request.params.projectId);
        return { success: true, branch };
      } catch (err: any) {
        log.error('git', `Checkout failed: ${branch}`, err.message, request.params.projectId);
        return reply.status(500).send({ error: err.message });
      }
    }
  );

  app.post<{ Params: { projectId: string }; Body: { file: string; type: 'staged' | 'unstaged' | 'untracked'; subrepo?: string } }>(
    '/api/projects/:projectId/git/discard',
    async (request, reply) => {
      const path = await getProjectPath(request.params.projectId, request.body.subrepo);
      if (!path) return reply.status(404).send({ error: 'Project not found' });
      try {
        await gitService.discardFile(path, request.body.file, request.body.type);
        return { success: true };
      } catch (err: any) {
        return reply.status(500).send({ error: err.message });
      }
    }
  );

  app.post<{ Params: { projectId: string }; Body: { section: 'staged' | 'unstaged'; subrepo?: string } }>(
    '/api/projects/:projectId/git/discard-all',
    async (request, reply) => {
      const path = await getProjectPath(request.params.projectId, request.body.subrepo);
      if (!path) return reply.status(404).send({ error: 'Project not found' });
      try {
        await gitService.discardAll(path, request.body.section);
        return { success: true };
      } catch (err: any) {
        return reply.status(500).send({ error: err.message });
      }
    }
  );

  app.post<{ Params: { projectId: string }; Body: { subrepo?: string } }>(
    '/api/projects/:projectId/git/undo-commit',
    async (request, reply) => {
      const path = await getProjectPath(request.params.projectId, (request.body as any)?.subrepo);
      if (!path) return reply.status(404).send({ error: 'Project not found' });

      try {
        await gitService.undoLastCommit(path);
        return { success: true };
      } catch (err: any) {
        return reply.status(400).send({ error: err.message });
      }
    }
  );

  // Generate commit message using the configured AI provider
  app.post<{ Params: { projectId: string }; Body: { subrepo?: string, providerId?: string } }>(
    '/api/projects/:projectId/git/generate-commit-message',
    async (request, reply) => {
      const path = await getProjectPath(request.params.projectId, (request.body as any)?.subrepo);
      if (!path) return reply.status(404).send({ error: 'Project not found' });

      // TODO: Get provider from a user setting. For now, use Claude or the first available.
      const providerId = request.body.providerId || ai.getAvailableProviders()[0]?.id;
      if (!providerId) {
        return reply.status(503).send({ error: 'No AI providers available.' });
      }

      const definition = ai.getProviderDefinition(providerId);
      const config = await ai.loadProviderConfig(providerId);

      if (!definition || !config.apiKey) {
        return reply.status(503).send({ error: `AI provider '${providerId}' is not configured.` });
      }

      try {
        const diff = await gitService.getDiff(path, undefined, true);
        if (!diff.trim()) {
          return reply.status(400).send({ error: 'No staged changes' });
        }

        const compactDiff = compactGitDiff(diff, 15000);

        const message = await definition.implementation.generateCommitMessage(config, compactDiff);

        return { message, source: providerId };
      } catch (err: any) {
        log.error('git', `Generate commit message failed for ${providerId}`, err.message, request.params.projectId);
        if (!reply.sent) {
          return reply.status(500).send({ error: err.message || 'Failed to generate commit message' });
        }
      }
    }
  );

  app.get<{ Params: { projectId: string }; Querystring: { hash: string; subrepo?: string } }>(
    '/api/projects/:projectId/git/commit-diff',
    async (request, reply) => {
      const path = await getProjectPath(request.params.projectId, request.query.subrepo);
      if (!path) return reply.status(404).send({ error: 'Project not found' });
      const { hash } = request.query;
      if (!hash || typeof hash !== 'string') return reply.status(400).send({ error: 'Commit hash is required' });

      try {
        const result = await gitService.getCommitDiff(path, hash);
        return result;
      } catch (err: any) {
        return reply.status(500).send({ error: err.message });
      }
    }
  );

  app.get<{ Params: { projectId: string }; Querystring: { subrepo?: string } }>(
    '/api/projects/:projectId/git/main-commit',
    async (request, reply) => {
      const path = await getProjectPath(request.params.projectId, request.query.subrepo);
      if (!path) return reply.status(404).send({ error: 'Project not found' });

      try {
        const commit = await gitService.getMainBranchLastCommit(path);
        return { commit };
      } catch (err: any) {
        return reply.status(500).send({ error: err.message });
      }
    }
  );
}
