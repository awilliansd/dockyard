import { FastifyInstance } from 'fastify';
import { getProjects, refreshProjects, updateProject, scanDirectory, addProjects, removeProject } from '../services/projectDiscovery.js';

export async function projectRoutes(app: FastifyInstance) {
  app.get('/api/projects', async () => {
    const projects = await getProjects();
    return { projects };
  });

  app.post('/api/projects/refresh', async () => {
    const projects = await refreshProjects();
    return { projects };
  });

  app.patch<{ Params: { id: string }; Body: { name?: string; favorite?: boolean; lastOpenedAt?: string; externalLink?: string } }>(
    '/api/projects/:id',
    async (request, reply) => {
      const { id } = request.params;
      const project = await updateProject(id, request.body);
      if (!project) {
        return reply.status(404).send({ error: 'Project not found' });
      }
      return project;
    }
  );

  // Scan a directory to discover projects (returns list, doesn't add them)
  app.post<{ Body: { directory: string } }>(
    '/api/projects/scan',
    async (request) => {
      const results = await scanDirectory(request.body.directory);
      return { projects: results };
    }
  );

  // Add selected project paths to the dashboard
  app.post<{ Body: { paths: string[] } }>(
    '/api/projects/add',
    async (request) => {
      const projects = await addProjects(request.body.paths);
      return { projects };
    }
  );

  // Remove a project from the dashboard
  app.post<{ Body: { path: string } }>(
    '/api/projects/remove',
    async (request) => {
      const projects = await removeProject(request.body.path);
      return { projects };
    }
  );
}
