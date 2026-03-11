import Fastify from 'fastify';
import cors from '@fastify/cors';
import websocket from '@fastify/websocket';
import { projectRoutes } from './routes/projects.js';
import { taskRoutes } from './routes/tasks.js';
import { gitRoutes } from './routes/git.js';
import { terminalRoutes } from './routes/terminals.js';
import { terminalWsRoutes } from './routes/terminalWs.js';
import { settingsRoutes } from './routes/settings.js';
import { syncRoutes } from './routes/sync.js';
import { initProjectDiscovery } from './services/projectDiscovery.js';
import { loadSettings } from './services/settingsStore.js';
import { isAvailable as isTerminalAvailable } from './services/terminalService.js';

const app = Fastify({ logger: true });

await app.register(cors, {
  origin: ['http://localhost:5421'],
});
await app.register(websocket);

await app.register(projectRoutes);
await app.register(taskRoutes);
await app.register(gitRoutes);
await app.register(terminalRoutes);
await app.register(terminalWsRoutes);
await app.register(settingsRoutes);
await app.register(syncRoutes);

await loadSettings();
await initProjectDiscovery();

try {
  await app.listen({ port: 5420, host: '0.0.0.0' });
  console.log('DevDash server running on http://localhost:5420');
  console.log(`Terminal integration: ${isTerminalAvailable() ? 'available' : 'disabled (node-pty not found)'}`);
} catch (err) {
  app.log.error(err);
  process.exit(1);
}
