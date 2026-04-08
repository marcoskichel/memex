import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import type { AxonClient, RecallParams } from '@neurome/axon';
import { recallOptionsSchema } from '@neurome/cortex-ipc';
import { z } from 'zod';

function toTextContent(value: unknown) {
  return { content: [{ type: 'text' as const, text: JSON.stringify(value, undefined, 2) }] };
}

function toErrorContent(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return { content: [{ type: 'text' as const, text: message }], isError: true as const };
}

function registerRecall(server: McpServer, axon: AxonClient): void {
  server.registerTool(
    'recall',
    {
      description: 'Search memory for relevant records matching a natural language query.',
      inputSchema: z.object({ query: z.string(), options: recallOptionsSchema.optional() }),
    },
    async ({ query, options }) => {
      try {
        const params: RecallParams =
          options === undefined ? {} : { options: options as RecallParams['options'] };
        return toTextContent(await axon.recall(query, params));
      } catch (error) {
        return toErrorContent(error);
      }
    },
  );
}

function registerGetRecent(server: McpServer, axon: AxonClient): void {
  server.registerTool(
    'get_recent',
    {
      description: 'Get the most recently stored memory records.',
      inputSchema: z.object({ limit: z.number().int().positive() }),
    },
    async ({ limit }) => {
      try {
        return toTextContent(await axon.getRecent(limit));
      } catch (error) {
        return toErrorContent(error);
      }
    },
  );
}

function registerGetStats(server: McpServer, axon: AxonClient): void {
  server.registerTool(
    'get_stats',
    { description: 'Get current memory system statistics.', inputSchema: z.object({}) },
    async () => {
      try {
        return toTextContent(await axon.getStats());
      } catch (error) {
        return toErrorContent(error);
      }
    },
  );
}

export function createServer(axon: AxonClient, engramId: string): McpServer {
  const server = new McpServer({ name: 'dendrite', version: '0.0.0' });

  registerRecall(server, axon);

  server.registerTool(
    'get_context',
    {
      description: 'Retrieve assembled context for a tool call.',
      inputSchema: z.object({
        tool_name: z.string(),
        tool_input: z.unknown(),
        category: z.string().optional(),
      }),
    },
    async ({ tool_name: toolName, tool_input: toolInput, category }) => {
      try {
        const payload = {
          engramId,
          toolName,
          toolInput,
          ...(category === undefined ? {} : { category }),
        };
        return toTextContent(await axon.getContext(payload));
      } catch (error) {
        return toErrorContent(error);
      }
    },
  );

  registerGetRecent(server, axon);
  registerGetStats(server, axon);
  return server;
}

export async function startServer(axon: AxonClient, engramId: string): Promise<void> {
  const server = createServer(axon, engramId);
  const transport = new StdioServerTransport();
  await server.connect(transport);
}
