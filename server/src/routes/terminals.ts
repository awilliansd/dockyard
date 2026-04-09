import { FastifyInstance } from 'fastify';
import { launchTerminal, openFolder, TerminalType } from '../services/terminalLauncher.js';
import { getProjects, updateProject } from '../services/projectDiscovery.js';
import * as log from '../services/logService.js';

export async function terminalRoutes(app: FastifyInstance) {
  app.post<{ Body: { projectId: string; type: TerminalType; runtime?: 'openclaude' | 'codex' | 'gemini' | 'omniroute'; skipPermissions?: boolean } }>(
    '/api/terminals/launch',
    async (request, reply) => {
      const projects = await getProjects();
      const project = projects.find(p => p.id === request.body.projectId);
      if (!project) return reply.status(404).send({ error: 'Project not found' });

      try {
        await launchTerminal(project.path, request.body.type, project.name, {
          runtime: request.body.runtime,
          skipPermissions: request.body.skipPermissions,
        });
        await updateProject(project.id, { lastOpenedAt: new Date().toISOString() });
        log.info('terminal', `Launched ${request.body.type} terminal`, project.name, project.id);
        return { success: true };
      } catch (err: any) {
        log.error('terminal', `Failed to launch ${request.body.type} terminal`, err.message, project.id);
        throw err;
      }
    }
  );

  app.post<{ Body: { projectId: string } }>(
    '/api/terminals/folder',
    async (request, reply) => {
      const projects = await getProjects();
      const project = projects.find(p => p.id === request.body.projectId);
      if (!project) return reply.status(404).send({ error: 'Project not found' });

      try {
        await openFolder(project.path);
        return { success: true };
      } catch (err: any) {
        log.error('terminal', 'Failed to open folder', err.message, project.id);
        throw err;
      }
    }
  );
}
