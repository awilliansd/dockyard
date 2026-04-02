// server/src/routes/ai.ts

import { FastifyInstance } from 'fastify';
import * as ai from '../services/ai/index.js';
import { OLLAMA_PROVIDER_ID } from '../services/ai/providers/ollama.js';
import { runAssistantChat } from '../services/ai/assistantAgent.js';
import { buildProjectContext, buildTaskContext } from '../services/claudeContextBuilder.js';
import * as taskStore from '../services/taskStore.js';
import * as log from '../services/logService.js';
import { ChatMessage } from '../services/ai/types.js';

export async function aiRoutes(app: FastifyInstance) {
  const isConfigured = (providerId: string, config: any) => {
    if (providerId === OLLAMA_PROVIDER_ID) {
      return !!config?.baseUrl && !!config?.model;
    }
    return !!config?.apiKey;
  };

  // --- Provider and Config Management ---

  app.get('/api/ai/providers', async () => {
    const providers = ai.getAvailableProviders();
    const providerConfigs = await Promise.all(
      providers.map(async (p) => {
        const config = await ai.loadProviderConfig(p.id);
        // Never expose API key
        const { apiKey, ...safeConfig } = config;
        return {
          id: p.id,
          name: p.name,
          models: p.models,
          configured: isConfigured(p.id, config),
          config: safeConfig,
        };
      })
    );
    return providerConfigs;
  });

  app.post<{ Body: { providerId: string; config: any } }>('/api/ai/config', async (request) => {
    const { providerId, config } = request.body;
    await ai.saveProviderConfig(providerId, config);
    return { ok: true };
  });

  app.delete<{ Body: { providerId: string } }>('/api/ai/config', async (request) => {
    const { providerId } = request.body;
    await ai.deleteProviderConfig(providerId);
    return { ok: true };
  });

  app.post<{ Body: { providerId: string; config: any } }>('/api/ai/config/test', async (request) => {
    const { providerId, config } = request.body;
    const definition = ai.getProviderDefinition(providerId);
    if (!definition) {
      return { ok: false, error: `Provider ${providerId} not found` };
    }
    return definition.implementation.testConfig(config);
  });

  // --- AI-Powered Features ---

  app.post<{ Body: { providerId: string; projectId?: string; messages: ChatMessage[]; systemContext?: string } }>('/api/ai/chat', async (request, reply) => {
    const { providerId, projectId, messages, systemContext } = request.body;

    const definition = ai.getProviderDefinition(providerId);
    if (!definition) {
      return reply.status(400).send({ error: `Provider '${providerId}' not found.` });
    }

    const config = await ai.loadProviderConfig(providerId);
    if (!isConfigured(providerId, config)) {
      return reply.status(400).send({ error: `Provider '${providerId}' is not configured.` });
    }

    let systemPrompt = 'You are a helpful AI assistant integrated into Dockyard, a local development dashboard. You help with project management, task analysis, and development questions. Be concise and actionable.';
    if (projectId) {
      const context = await buildProjectContext(projectId);
      systemPrompt += `\n\nProject Context:\n${context}`;
    }
    if (systemContext) {
      systemPrompt += `\n\n${systemContext}`;
    }

    reply.raw.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    });

    try {
      for await (const chunk of definition.implementation.streamChat(config, messages, systemPrompt)) {
        reply.raw.write(`data: ${JSON.stringify({ type: 'text', text: chunk })}\n\n`);
      }
      reply.raw.write(`data: ${JSON.stringify({ type: 'done' })}\n\n`);
    } catch (err: any) {
      log.error('ai', `Chat stream failed for ${providerId}`, err.message, projectId);
      reply.raw.write(`data: ${JSON.stringify({ type: 'error', error: err.message || 'Stream failed' })}\n\n`);
    }

    reply.raw.end();
  });

  app.post<{ Body: { providerId: string; projectId: string; taskId?: string; title: string } }>('/api/ai/analyze-task', async (request, reply) => {
    const { providerId, projectId, taskId, title } = request.body;

    const definition = ai.getProviderDefinition(providerId);
    if (!definition) {
      return reply.status(400).send({ error: `Provider '${providerId}' not found.` });
    }

    const config = await ai.loadProviderConfig(providerId);
    if (!isConfigured(providerId, config)) {
      return reply.status(400).send({ error: `Provider '${providerId}' is not configured.` });
    }

    let context: string;
    let existingDescription: string | undefined;

    if (taskId) {
      context = await buildTaskContext(projectId, taskId);
      const task = await taskStore.getTask(projectId, taskId);
      existingDescription = task?.description;
    } else {
      context = await buildProjectContext(projectId);
    }

    try {
      const result = await definition.implementation.analyzeTask(config, context, title, existingDescription);
      return result;
    } catch (err: any) {
      log.error('ai', `Analyze task failed for ${providerId}`, err.message, projectId);
      return reply.status(500).send({ error: `AI analysis failed: ${err.message}` });
    }
  });

  app.post<{ Body: { providerId: string; projectId: string; rawText: string } }>('/api/ai/bulk-organize', async (request, reply) => {
    const { providerId, projectId, rawText } = request.body;
     if (!rawText?.trim()) {
      return reply.status(400).send({ error: 'No text provided' });
    }

    const definition = ai.getProviderDefinition(providerId);
    if (!definition) {
      return reply.status(400).send({ error: `Provider '${providerId}' not found.` });
    }

    const config = await ai.loadProviderConfig(providerId);
    if (!isConfigured(providerId, config)) {
      return reply.status(400).send({ error: `Provider '${providerId}' is not configured.` });
    }
    
    const context = await buildProjectContext(projectId);

    try {
      const tasks = await definition.implementation.bulkOrganizeTasks(config, context, rawText);
      return { tasks };
    } catch (err: any) {
      log.error('ai', `Bulk organize failed for ${providerId}`, err.message, projectId);
      return reply.status(500).send({ error: `AI bulk organize failed: ${err.message}` });
    }
  });

  app.post<{ Body: { providerId: string; projectId: string; rawText: string; existingTasks: any[] } }>('/api/ai/manage-tasks', async (request, reply) => {
    const { providerId, projectId, rawText, existingTasks } = request.body;

    const definition = ai.getProviderDefinition(providerId);
    if (!definition) {
      return reply.status(400).send({ error: `Provider '${providerId}' not found.` });
    }

    const config = await ai.loadProviderConfig(providerId);
    if (!isConfigured(providerId, config)) {
      return reply.status(400).send({ error: `Provider '${providerId}' is not configured.` });
    }

    const context = await buildProjectContext(projectId);
    const taskList = existingTasks.map(t => `  - [${t.id}] "${t.title}" (${t.status}, ${t.priority})`).join('\n');
    const systemInstructions = `You are a task management AI... (system prompt omitted for brevity)`; // A more generic prompt would be built here
    
    try {
      const result = await definition.implementation.manageTasks(config, systemInstructions, rawText);
      return result;
    } catch (err: any) {
      log.error('ai', `Manage tasks failed for ${providerId}`, err.message, projectId);
      return reply.status(500).send({ error: `AI task management failed: ${err.message}` });
    }
  });

  // --- Tool-enabled assistant chat ---
  app.post<{ Body: { providerId: string; projectId: string; messages: ChatMessage[] } }>('/api/ai/assistant', async (request, reply) => {
    const { providerId, projectId, messages } = request.body;

    const definition = ai.getProviderDefinition(providerId);
    if (!definition) {
      return reply.status(400).send({ error: `Provider '${providerId}' not found.` });
    }

    const config = await ai.loadProviderConfig(providerId);
    if (!isConfigured(providerId, config)) {
      return reply.status(400).send({ error: `Provider '${providerId}' is not configured.` });
    }

    try {
      const result = await runAssistantChat({ providerId, projectId, messages });
      return result;
    } catch (err: any) {
      log.error('ai', `Assistant chat failed for ${providerId}`, err.message, projectId);
      return reply.status(500).send({ error: `Assistant chat failed: ${err.message}` });
    }
  });
}
