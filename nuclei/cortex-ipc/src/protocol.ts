import type { LtmInsertOptions } from '@neurome/ltm';
export type { EntityMention, EntityType, LtmRecord } from '@neurome/ltm';
import type { Memory, MemoryEvents } from '@neurome/memory';
import { z } from 'zod';

const VALID_ENGRAM_ID = /^[\da-z][\w-]{0,127}$/i;

export function IPC_SOCKET_PATH(engramId: string): string {
  if (!VALID_ENGRAM_ID.test(engramId)) {
    throw new Error(`Invalid engramId: ${engramId}`);
  }
  return `/tmp/neurome-${engramId}.sock`;
}

export type LogInsightPayload = Parameters<Memory['logInsight']>[0];
export type RecallOptions = Parameters<Memory['recall']>[1];

export const recallOptionsSchema = z.object({
  limit: z.number().int().positive().optional(),
  threshold: z.number().min(0).max(1).optional(),
  strengthen: z.boolean().optional(),
  tier: z.enum(['episodic', 'semantic']).optional(),
  minImportance: z.number().optional(),
  after: z.coerce.date().optional(),
  before: z.coerce.date().optional(),
  minStability: z.number().optional(),
  minAccessCount: z.number().int().optional(),
  sort: z.enum(['confidence', 'recency', 'stability', 'importance']).optional(),
  category: z.string().optional(),
  tags: z.array(z.string()).optional(),
  minResults: z.number().int().optional(),
  entityName: z.string().optional(),
  entityType: z.enum(['person', 'project', 'concept', 'preference', 'decision', 'tool']).optional(),
  currentEntityIds: z.array(z.number().int()).optional(),
  currentEntityHint: z.array(z.string()).optional(),
});

export interface GetContextPayload {
  engramId: string;
  toolName: string;
  toolInput: unknown;
  category?: string;
}

export interface RecallPayload {
  query: string;
  options?: RecallOptions;
}

export type GetStatsPayload = Record<string, never>;

export interface InsertMemoryPayload {
  data: string;
  options?: LtmInsertOptions;
}

export interface ImportTextPayload {
  text: string;
}

export interface GetRecentPayload {
  limit: number;
}

export type ConsolidatePayload = Record<string, never>;

export interface ForkPayload {
  outputPath: string;
}

interface RequestPayloadMap {
  logInsight: LogInsightPayload;
  getContext: GetContextPayload;
  recall: RecallPayload;
  getStats: GetStatsPayload;
  insertMemory: InsertMemoryPayload;
  importText: ImportTextPayload;
  getRecent: GetRecentPayload;
  consolidate: ConsolidatePayload;
  fork: ForkPayload;
}

export const REQUEST_TYPES = [
  'logInsight',
  'getContext',
  'recall',
  'getStats',
  'insertMemory',
  'importText',
  'getRecent',
  'consolidate',
  'fork',
] as const;

export type RequestType = (typeof REQUEST_TYPES)[number];

export type RequestMessage = {
  [K in RequestType]: { id: string; type: K; payload: RequestPayloadMap[K] };
}[RequestType];

export type ResponseMessage =
  | { id: string; ok: true; result: unknown }
  | { id: string; ok: false; error: string };

export type MemoryEventName = keyof MemoryEvents;

export interface PushMessage {
  type: 'event';
  name: MemoryEventName;
  payload: unknown;
}
