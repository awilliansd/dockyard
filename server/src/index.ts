import Fastify from 'fastify';
import cors from '@fastify/cors';
import fastifyStatic from '@fastify/static';
import websocket from '@fastify/websocket';
import { resolve } from 'path';
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

// Read config from env (set by Electron) or use defaults
const PORT = parseInt(process.env.SHIPYARD_PORT || '5420', 10);
const HOST = process.env.SHIPYARD_HOST || '0.0.0.0';
const STATIC_DIR = process.env.SHIPYARD_STATIC_DIR || '';
const IS_ELECTRON = !!process.env.SHIPYARD_ELECTRON;

const app = Fastify({ logger: !IS_ELECTRON });

// CORS: allow Vite dev server and Electron
const origins = IS_ELECTRON
  ? [`http://localhost:${PORT}`, `http://127.0.0.1:${PORT}`]
  : ['http://localhost:5421'];

await app.register(cors, { origin: origins });
await app.register(websocket);

// In production (Electron), serve the built client as static files
if (STATIC_DIR) {
  const staticRoot = resolve(STATIC_DIR);
  console.log(`Registering static files from: ${staticRoot}`);
  try {
    await app.register(fastifyStatic, {
      root: staticRoot,
      prefix: '/',
      wildcard: false,
    });
    console.log('Static file serving registered successfully');
  } catch (err) {
    console.error('Failed to register static files:', err);
  }
} else {
  console.log('No STATIC_DIR set, skipping static file serving');
}

await app.register(projectRoutes);
await app.register(taskRoutes);
await app.register(gitRoutes);
await app.register(terminalRoutes);
await app.register(terminalWsRoutes);
await app.register(settingsRoutes);
await app.register(syncRoutes);

// SPA fallback: serve index.html for all non-API, non-WS routes
if (STATIC_DIR) {
  app.setNotFoundHandler(async (_req, reply) => {
    return reply.sendFile('index.html');
  });
}

await loadSettings();
await initProjectDiscovery();

try {
  await app.listen({ port: PORT, host: HOST });
  console.log(`Shipyard server running on http://${HOST}:${PORT}`);
  console.log(`Terminal integration: ${isTerminalAvailable() ? 'available' : 'disabled (node-pty not found)'}`);
  if (IS_ELECTRON) console.log('Mode: Electron embedded');
  if (STATIC_DIR) console.log(`Serving static files from: ${STATIC_DIR}`);
} catch (err: any) {
  if (err?.code === 'EADDRINUSE') {
    console.error(`Port ${PORT} is already in use. Is another instance running?`);
  } else {
    console.error('Failed to start server:', err);
  }
  process.exit(1);
}
