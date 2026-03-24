import type { ChatMessage } from './types.js';
import { ASSISTANT_TOOLS, runAssistantTool, getWritePreview } from './assistantTools.js';
import * as ai from './index.js';

export interface ToolCallLog {
  name: string;
  args: Record<string, any>;
  ok: boolean;
  result?: any;
  error?: string;
}

const MAX_TOOL_STEPS = 6;
const DESTRUCTIVE_TOOLS = new Set(['write_file', 'delete_file', 'rename_file', 'git_commit']);

function buildSystemPrompt(projectId: string) {
  const toolList = ASSISTANT_TOOLS.map(t => `- ${t.name}: ${t.description}`).join('\n');
  return [
    'You are Shipyard\'s internal AI assistant. You can read and edit project files using tools.',
    'When you need to use a tool, respond ONLY with JSON in one of these formats:',
    '{"tool":"tool_name","args":{...}}',
    '{"tool_calls":[{"name":"tool_name","args":{...}}, ...]}',
    'Do not include any other text when calling tools.',
    'When editing files, always read the file first and then write the full updated content.',
    'When you are ready to answer the user, respond normally in plain text/markdown.',
    'The projectId is provided by the system; do NOT include it in tool args.',
    '',
    `ProjectId: ${projectId}`,
    'Available tools:',
    toolList,
  ].join('\n');
}

function parseToolRequest(text: string): { toolCalls: Array<{ name: string; args: Record<string, any> }> } | null {
  let candidate = text.trim();
  if (!candidate.startsWith('{')) {
    const start = candidate.indexOf('{');
    const end = candidate.lastIndexOf('}');
    if (start === -1 || end === -1 || end <= start) return null;
    candidate = candidate.slice(start, end + 1);
  }
  try {
    const parsed = JSON.parse(candidate);
    if (parsed && parsed.tool && typeof parsed.tool === 'string') {
      return { toolCalls: [{ name: parsed.tool, args: parsed.args || {} }] };
    }
    if (parsed && Array.isArray(parsed.tool_calls)) {
      const calls = parsed.tool_calls
        .filter((c: any) => c && typeof c.name === 'string')
        .map((c: any) => ({ name: c.name, args: c.args || {} }));
      if (calls.length > 0) return { toolCalls: calls };
    }
  } catch {
    return null;
  }
  return null;
}

async function collectStream(gen: AsyncGenerator<string>): Promise<string> {
  let out = '';
  for await (const chunk of gen) out += chunk;
  return out;
}

export async function runAssistantChat(params: {
  providerId: string;
  projectId: string;
  messages: ChatMessage[];
  safeMode?: boolean;
}): Promise<{ message: string; toolCalls: ToolCallLog[]; pendingToolCalls?: Array<{ name: string; args: Record<string, any>; preview?: string }> }> {
  const { providerId, projectId, safeMode } = params;
  const messages: ChatMessage[] = [...params.messages];

  const definition = ai.getProviderDefinition(providerId);
  if (!definition) {
    throw new Error(`Provider '${providerId}' not found.`);
  }

  const config = await ai.loadProviderConfig(providerId);
  const systemPrompt = buildSystemPrompt(projectId);

  const toolCalls: ToolCallLog[] = [];

  for (let step = 0; step < MAX_TOOL_STEPS; step++) {
    const responseText = await collectStream(
      definition.implementation.streamChat(config as any, messages, systemPrompt)
    );

    const toolRequest = parseToolRequest(responseText);
    if (!toolRequest) {
      return { message: responseText.trim(), toolCalls };
    }

    if (safeMode) {
      const destructive = toolRequest.toolCalls.filter(c => DESTRUCTIVE_TOOLS.has(c.name));
      if (destructive.length > 0) {
        const pending: Array<{ name: string; args: Record<string, any>; preview?: string }> = [];
        for (const call of destructive) {
          if (call.name === 'write_file') {
            const preview = await getWritePreview(projectId, call.args?.path, call.args?.content);
            pending.push({
              name: call.name,
              args: call.args || {},
              preview: preview.ok ? preview.data?.preview : `Preview unavailable: ${preview.error || 'unknown error'}`,
            });
          } else {
            pending.push({ name: call.name, args: call.args || {} });
          }
        }
        return {
          message: 'Pending changes require confirmation.',
          toolCalls,
          pendingToolCalls: pending,
        };
      }
    }

    for (const call of toolRequest.toolCalls) {
      const result = await runAssistantTool(call.name, call.args || {}, projectId);
      toolCalls.push({
        name: call.name,
        args: call.args || {},
        ok: result.ok,
        result: result.ok ? result.data : undefined,
        error: result.ok ? undefined : result.error,
      });

      messages.push({ role: 'assistant', content: JSON.stringify({ tool: call.name, args: call.args || {} }) });
      messages.push({ role: 'user', content: `Tool result (${call.name}): ${JSON.stringify(result)}` });
    }
  }

  return { message: 'Tool limit reached. Please refine your request.', toolCalls };
}
