export type { EntityMention, EntityType } from '@neurome/entorhinal';
import type { EntityMention } from '@neurome/entorhinal';
import type { LtmInsertOptions } from '@neurome/ltm';
export type { LtmRecord } from '@neurome/ltm';
import type { ConsolidateTarget, Memory, MemoryEvents } from '@neurome/memory';
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

const MAX_STABILITY_DAYS = 365;

export const recallOptionsSchema = z.object({
  limit: z
    .number()
    .int()
    .positive()
    .optional()
    .describe('Maximum number of records to return. Omit to return all records above threshold.'),
  threshold: z
    .number()
    .min(0)
    .max(1)
    .optional()
    .describe(
      'Minimum effective score (semantic similarity × retention) for a record to be included. Range 0–1, default 0.5. Lower values return more but less relevant results.',
    ),
  strengthen: z
    .boolean()
    .optional()
    .describe(
      'Whether recalling records reinforces their stability (making them easier to recall in future). Default true. Set false for read-only queries that should not affect memory weights.',
    ),
  tier: z
    .enum(['episodic', 'semantic'])
    .optional()
    .describe(
      '"episodic" holds raw experiences and conversation snippets. "semantic" holds consolidated facts and long-term knowledge. Omit to search both.',
    ),
  minImportance: z
    .number()
    .min(0)
    .max(1)
    .optional()
    .describe(
      'Only return records with importance >= this value. Range 0–1, where 0 is default and 1 is maximum. Use to surface only high-signal memories.',
    ),
  after: z.coerce
    .date()
    .optional()
    .describe('Only return records created after this ISO 8601 datetime.'),
  before: z.coerce
    .date()
    .optional()
    .describe('Only return records created before this ISO 8601 datetime.'),
  minStability: z
    .number()
    .min(0)
    .max(MAX_STABILITY_DAYS)
    .optional()
    .describe(
      'Only return records with stability >= this value. Stability is measured in days (range 0.5–365); higher values mean the memory decays more slowly. Use to filter out fragile or transient memories.',
    ),
  minAccessCount: z
    .number()
    .int()
    .min(0)
    .optional()
    .describe(
      'Only return records recalled at least this many times. Use to surface well-established memories that have proven repeatedly relevant.',
    ),
  sort: z
    .enum(['confidence', 'recency', 'stability', 'importance'])
    .optional()
    .describe(
      'Sort order. "confidence" (default) sorts by effective score (similarity × retention). "recency" sorts by last access time. "stability" and "importance" sort by those stored values.',
    ),
  category: z
    .string()
    .optional()
    .describe(
      'Filter by exact category. Standard values: "user_preference", "world_fact", "task_context", "agent_belief".',
    ),
  tags: z
    .array(z.string())
    .optional()
    .describe(
      'Filter records that have ALL of these tags (AND semantics). Only records tagged with every specified tag are returned.',
    ),
  minResults: z
    .number()
    .int()
    .min(0)
    .optional()
    .describe(
      'Minimum number of results to return. If fewer records pass the threshold, lower-scoring candidates are added to meet this floor. Useful when you need at least N results regardless of quality.',
    ),
  entityName: z
    .string()
    .optional()
    .describe(
      'Filter and boost records associated with an entity whose name contains this string (case-insensitive substring match). Use to narrow recall to a specific person, project, or concept.',
    ),
  entityType: z
    .string()
    .optional()
    .describe(
      'Filter and boost records associated with entities of this type. Suggested: person, project, concept, preference, decision, tool, screen. Combine with entityName for precise entity-scoped recall.',
    ),
  currentEntityIds: z
    .array(z.number().int().positive())
    .optional()
    .describe(
      'Anchor recall to specific entities by their IDs in the knowledge graph. Enriches results by traversing entity relationships. Use when you already know the entity IDs. Mutually exclusive with currentEntityHint.',
    ),
  currentEntityHint: z
    .array(z.string())
    .optional()
    .describe(
      'Anchor recall to entities matching these name strings, resolved via embedding similarity. Use when you know entity names but not their IDs. Mutually exclusive with currentEntityIds.',
    ),
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

export interface ConsolidatePayload {
  target?: ConsolidateTarget;
}

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

export { type ConsolidateTarget } from '@neurome/memory';

export interface MemoryEntry {
  memory: string;
  tier: 'episodic' | 'semantic';
  relevance: 'high' | 'medium' | 'low';
  tags: string[];
  entities: EntityMention[];
  recordedAt: string;
  superseded?: true;
}

export interface MemoryChange {
  type: 'changed';
  current: MemoryEntry;
  supersedes: MemoryEntry;
}

export type RecallResult = MemoryEntry | MemoryChange;
