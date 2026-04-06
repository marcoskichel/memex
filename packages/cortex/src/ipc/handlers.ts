import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';

import type { Memory } from '@memex/memory';

import type { RequestMessage, ResponseMessage } from './protocol.js';

const RECALL_LIMIT_FOR_CONTEXT = 5;
const RECENT_CONTEXT_FILE_LIMIT = 3;
const SCORE_PRECISION = 3;

export async function handleRequest(
  message: RequestMessage,
  memory: Memory,
): Promise<ResponseMessage> {
  try {
    const result = await dispatch(message, memory);
    return { id: message.id, ok: true, result };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return { id: message.id, ok: false, error: errorMessage };
  }
}

async function dispatch(message: RequestMessage, memory: Memory): Promise<unknown> {
  switch (message.type) {
    case 'logInsight': {
      logInsight(message.payload, memory);
      return undefined;
    }
    case 'getContext': {
      return getContext(message.payload, memory);
    }
    case 'recall': {
      return recallMemory(message.payload, memory);
    }
    case 'getStats': {
      return getStats(memory);
    }
    default: {
      const exhaustive: never = message;
      throw new Error(`unknown request type: ${(exhaustive as { type: string }).type}`);
    }
  }
}

function logInsight(
  payload: Extract<RequestMessage, { type: 'logInsight' }>['payload'],
  memory: Memory,
): void {
  memory.logInsight(payload);
}

async function getContext(
  payload: Extract<RequestMessage, { type: 'getContext' }>['payload'],
  memory: Memory,
): Promise<string> {
  const recallResult = await memory.recall(JSON.stringify(payload.toolInput), {
    limit: RECALL_LIMIT_FOR_CONTEXT,
  });
  const stats = await memory.getStats();

  const contextDirectory = stats.disk.contextDirectory;
  const contextFiles = readRecentContextFiles({
    contextDirectory,
    sessionId: payload.sessionId,
    limit: RECENT_CONTEXT_FILE_LIMIT,
  });

  const parts: string[] = [];

  if (recallResult.isOk() && recallResult.value.length > 0) {
    const recallSection = recallResult.value
      .map((queryResult) => {
        const metaTags = queryResult.record.metadata.tags;
        const tags = Array.isArray(metaTags) ? ` [${(metaTags as string[]).join(', ')}]` : '';
        return `### ${queryResult.record.tier} record (score: ${queryResult.effectiveScore.toFixed(SCORE_PRECISION)})${tags}\n\n${queryResult.record.data}`;
      })
      .join('\n\n---\n\n');
    parts.push(recallSection);
  }

  if (contextFiles.length > 0) {
    parts.push(contextFiles.join('\n\n---\n\n'));
  }

  return parts.join('\n\n===\n\n');
}

async function recallMemory(
  payload: Extract<RequestMessage, { type: 'recall' }>['payload'],
  memory: Memory,
): Promise<unknown> {
  const result = await memory.recall(payload.query, payload.options);
  if (result.isErr()) {
    throw new Error(`recall failed: ${result.error.type}`);
  }
  return result.value.map(({ record: { embedding: _embedding, ...record }, ...rest }) => ({
    ...rest,
    record,
  }));
}

async function getStats(memory: Memory): Promise<unknown> {
  return memory.getStats();
}

interface ReadContextFilesOptions {
  contextDirectory: string;
  sessionId: string;
  limit: number;
}

function readRecentContextFiles({
  contextDirectory,
  sessionId,
  limit,
}: ReadContextFilesOptions): string[] {
  const sessionDirectory = path.join(contextDirectory, sessionId);
  if (!existsSync(sessionDirectory)) {
    return [];
  }
  return readdirSync(sessionDirectory)
    .map((name) => ({ name, mtime: statSync(path.join(sessionDirectory, name)).mtimeMs }))
    .toSorted((first, second) => second.mtime - first.mtime)
    .slice(0, limit)
    .map(({ name }) => readFileSync(path.join(sessionDirectory, name), 'utf8'));
}
