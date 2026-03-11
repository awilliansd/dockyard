import { FastifyInstance } from 'fastify';
import {
  isAvailable,
  createSession,
  getSession,
  killSession,
  listSessions,
  resizeSession,
} from '../services/terminalService.js';
import { getProjects, updateProject } from '../services/projectDiscovery.js';

export async function terminalWsRoutes(app: FastifyInstance) {
  // REST: Check if integrated terminal is available
  app.get('/api/terminal/status', async () => {
    return { available: isAvailable() };
  });

  // REST: List active sessions
  app.get<{ Querystring: { projectId?: string } }>(
    '/api/terminal/sessions',
    async (request) => {
      return { sessions: listSessions(request.query.projectId) };
    }
  );

  // REST: Create a new terminal session
  app.post<{ Body: { projectId: string; type?: string; cols?: number; rows?: number } }>(
    '/api/terminal/sessions',
    async (request, reply) => {
      if (!isAvailable()) {
        return reply.status(503).send({ error: 'Integrated terminal not available (node-pty not installed)' });
      }

      const { projectId, type = 'shell', cols = 80, rows = 24 } = request.body;
      const projects = await getProjects();
      const project = projects.find(p => p.id === projectId);
      if (!project) return reply.status(404).send({ error: 'Project not found' });

      const sessionId = await createSession(projectId, project.path, type, cols, rows, project.name);
      if (!sessionId) return reply.status(500).send({ error: 'Failed to create terminal session' });

      await updateProject(project.id, { lastOpenedAt: new Date().toISOString() });

      const session = getSession(sessionId);
      return {
        id: sessionId,
        projectId,
        type,
        title: session?.title || 'Terminal',
        createdAt: session?.createdAt,
      };
    }
  );

  // REST: Kill a session
  app.delete<{ Params: { sessionId: string } }>(
    '/api/terminal/sessions/:sessionId',
    async (request, reply) => {
      const killed = killSession(request.params.sessionId);
      if (!killed) return reply.status(404).send({ error: 'Session not found' });
      return { success: true };
    }
  );

  // WebSocket: Connect to a terminal session
  app.get<{ Params: { sessionId: string } }>(
    '/ws/terminal/:sessionId',
    { websocket: true },
    (socket, request) => {
      const session = getSession(request.params.sessionId);
      if (!session) {
        socket.send(JSON.stringify({ type: 'error', data: 'Session not found' }));
        socket.close();
        return;
      }

      // Send pty output to WebSocket client
      const onData = session.pty.onData((data: string) => {
        if (socket.readyState === 1) { // WebSocket.OPEN
          socket.send(JSON.stringify({ type: 'output', data }));
        }
      });

      // Handle pty exit
      const onExit = session.pty.onExit(({ exitCode }) => {
        if (socket.readyState === 1) {
          socket.send(JSON.stringify({ type: 'exit', code: exitCode }));
        }
        killSession(session.id);
      });

      // Handle messages from WebSocket client
      socket.on('message', (raw: Buffer | string) => {
        try {
          const msg = JSON.parse(typeof raw === 'string' ? raw : raw.toString());
          switch (msg.type) {
            case 'input':
              session.pty.write(msg.data);
              break;
            case 'resize':
              if (msg.cols && msg.rows) {
                resizeSession(session.id, msg.cols, msg.rows);
              }
              break;
          }
        } catch {}
      });

      // Clean up on WebSocket close
      socket.on('close', () => {
        onData.dispose();
        onExit.dispose();
        // Don't kill the session on disconnect — allow reconnection
      });
    }
  );
}
