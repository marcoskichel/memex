import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';

import type { Memory } from '@memex/memory';

import type { RequestMessage, ResponseMessage } from './protocol.js';

const RECALL_LIMIT_FOR_CONTEXT = 5;
const SECONDARY_QUERY_LIMIT = 2;
const RECENT_CONTEXT_FILE_LIMIT = 3;
const SCORE_PRECISION = 3;
const IDENTITY_QUERY = 'current user identity, agent goals, session context';
const PROJECT_QUERY = 'project being built, architectural decisions, codebase overview';

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
    case 'insertMemory': {
      return memory.insertMemory(message.payload.data, message.payload.options);
    }
    case 'importText': {
      return memory.importText(message.payload.text);
    }
    case 'getRecent': {
      return memory.getRecent(message.payload.limit);
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

type RecallResult = Awaited<ReturnType<Memory['recall']>>;

function mergeRecallResults(results: RecallResult[], limit: number) {
  const seen = new Map<
    number,
    {
      record: { id: number; tier: string; data: string; metadata: unknown };
      effectiveScore: number;
    }
  >();
  for (const result of results) {
    if (result.isErr()) {
      continue;
    }
    for (const item of result.value) {
      if (!seen.has(item.record.id)) {
        seen.set(item.record.id, item);
      }
    }
  }
  return [...seen.values()]
    .toSorted((first, second) => second.effectiveScore - first.effectiveScore)
    .slice(0, limit);
}

async function getContext(
  payload: Extract<RequestMessage, { type: 'getContext' }>['payload'],
  memory: Memory,
): Promise<string> {
  const [primaryResult, identityResult, projectResult, stats] = await Promise.all([
    memory.recall(JSON.stringify(payload.toolInput), { limit: RECALL_LIMIT_FOR_CONTEXT }),
    memory.recall(IDENTITY_QUERY, { limit: SECONDARY_QUERY_LIMIT }),
    memory.recall(PROJECT_QUERY, { limit: SECONDARY_QUERY_LIMIT }),
    memory.getStats(),
  ]);

  const merged = mergeRecallResults(
    [primaryResult, identityResult, projectResult],
    RECALL_LIMIT_FOR_CONTEXT,
  );

  const contextDirectory = stats.disk.contextDirectory;
  const contextFiles = readRecentContextFiles({
    contextDirectory,
    sessionId: payload.sessionId,
    limit: RECENT_CONTEXT_FILE_LIMIT,
  });

  const parts: string[] = [];

  if (merged.length > 0) {
    const recallSection = merged
      .map((queryResult) => {
        const metaTags = (queryResult.record.metadata as { tags?: unknown }).tags;
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
