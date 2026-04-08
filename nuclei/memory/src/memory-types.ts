import type { AgentProfile, AgentState, AmygdalaProcess } from '@neurome/amygdala';
import type { EntityNode, EntityPathStep } from '@neurome/entorhinal';
import type { HippocampusProcess } from '@neurome/hippocampus';
import type { LLMAdapter } from '@neurome/llm';
import type {
  EmbeddingAdapter,
  LtmEngine,
  LtmInsertOptions,
  LtmQueryError,
  LtmQueryOptions,
  LtmQueryResult,
  LtmRecord,
} from '@neurome/ltm';
import type { EntityExtractionProcess } from '@neurome/perirhinal';
import type { InsightLogLike } from '@neurome/stm';
import type { ResultAsync } from 'neverthrow';

import type { MemoryEventEmitter } from './memory-events.js';
import type { MemoryStats } from './memory-stats.js';

export type { AgentProfile, AgentState } from '@neurome/amygdala';

export type ConsolidateTarget = 'amygdala' | 'hippocampus' | 'all';

export type {
  AmygdalaStats,
  DiskStats,
  HippocampusStats,
  LtmStats,
  MemoryStats,
  StmStats,
} from './memory-stats.js';

const HOURS_IN_DAY = 24;
const MINUTES_IN_HOUR = 60;
const SECONDS_IN_MINUTE = 60;
const MS_IN_SECOND = 1000;
export const DEFAULT_PENDING_CONSOLIDATION_TTL_MS =
  HOURS_IN_DAY * MINUTES_IN_HOUR * SECONDS_IN_MINUTE * MS_IN_SECOND;

export interface MemoryConfig {
  storagePath: string;
  engramId?: string;
  contextDirectory?: string;
  llmAdapter: LLMAdapter;
  embeddingAdapter: EmbeddingAdapter;
  stm?: InsightLogLike;
  compressionThreshold?: number;
  amygdalaCadenceMs?: number;
  hippocampusScheduleMs?: number;
  maxTokens?: number;
  maxLLMCallsPerHour?: number;
  lowCostModeThreshold?: number;
  pendingConsolidationTtlMs?: number;
  agentState?: AgentState;
  agentProfile?: AgentProfile;
}

export interface MemoryImplDeps {
  engramId: string;
  events: MemoryEventEmitter;
  ltm: LtmEngine;
  embedder: EmbeddingAdapter;
  stm: InsightLogLike;
  amygdala: AmygdalaProcess;
  hippocampus: HippocampusProcess;
  perirhinalProcess?: EntityExtractionProcess;
  contextDirectory: string;
  llmAdapter: LLMAdapter;
  forkFn: (outputPath: string) => Promise<string>;
  pendingConsolidationTtlMs?: number;
}

export interface PendingConsolidation {
  pendingId: string;
  summary: string;
  confidence: number;
  sourceIds: number[];
  preservedFacts: string[];
  uncertainties: string[];
  createdAt: Date;
}

export interface ShutdownReport {
  engramId: string;
  shutdownAt: Date;
  durationMs: number;
  stmPhasesCompressed: number;
  insightsDrained: number;
  hippocampusCycleWaitedMs: number | undefined;
  ltmRecordsAtClose: number;
  contextFilesRemainingOnDisk: number;
}

export interface PruneContextFilesReport {
  deletedCount: number;
  deletedBytes: number;
  skippedCount: number;
  errors: { path: string; error: string }[];
}

export class ShutdownError extends Error {
  constructor() {
    super('Memory system is shutting down');
    this.name = 'ShutdownError';
  }
}

export class RecordNotFoundError extends Error {
  constructor(id: number) {
    super(`Record ${id.toString()} not found`);
    this.name = 'RecordNotFoundError';
  }
}

export class InsertMemoryError extends Error {
  readonly causeType: string;
  constructor(causeType: string) {
    super(`insertMemory failed: ${causeType}`);
    this.name = 'InsertMemoryError';
    this.causeType = causeType;
  }
}

export class ImportTextError extends Error {
  readonly causeType: string;
  constructor(causeType: string) {
    super(`importText failed: ${causeType}`);
    this.name = 'ImportTextError';
    this.causeType = causeType;
  }
}

export const ENTITY_HINT_SIMILARITY_THRESHOLD = 0.75;
export const ENTITY_PATH_RELIABILITY_THRESHOLD = 5;
export const ENTITY_CONTEXT_TOP_K = 3;

type RecallEntityPosition =
  | { currentEntityIds: number[]; currentEntityHint?: never }
  | { currentEntityHint: string[]; currentEntityIds?: never }
  | { currentEntityIds?: never; currentEntityHint?: never };

export type RecallOptions = LtmQueryOptions & RecallEntityPosition;

export interface EntityContext {
  entities: EntityNode[];
  selectedEntity: EntityNode;
  originEntity: EntityNode | undefined;
  navigationPath: EntityPathStep[] | undefined;
  pathReliability: 'ok' | 'degraded';
  entityResolved: boolean;
}

export type MemoryRecallResult = LtmQueryResult & { entityContext?: EntityContext };

export interface LogInsightOptions {
  summary: string;
  contextFile: string;
  tags?: string[];
}

export interface Memory {
  readonly engramId: string;
  readonly events: MemoryEventEmitter;
  logInsight(options: LogInsightOptions): void;
  recall(
    nlQuery: string,
    options?: RecallOptions,
  ): ResultAsync<MemoryRecallResult[], LtmQueryError>;
  recallSession(
    query: string,
    options: { engramId: string } & Omit<LtmQueryOptions, 'engramId'>,
  ): Promise<LtmQueryResult[]>;
  recallFull(
    id: number,
  ): ResultAsync<{ record: LtmRecord; episodeSummary: string | undefined }, RecordNotFoundError>;
  insertMemory(data: string, options?: LtmInsertOptions): ResultAsync<number, InsertMemoryError>;
  importText(text: string): ResultAsync<{ inserted: number }, ImportTextError>;
  getRecent(limit: number): LtmRecord[];
  consolidate(target?: ConsolidateTarget): Promise<void>;
  getPendingConsolidations(): PendingConsolidation[];
  approveConsolidation(pendingId: string): ResultAsync<number, InsertMemoryError>;
  discardConsolidation(pendingId: string): void;
  setAgentState(state: AgentState | undefined): void;
  getStats(): Promise<MemoryStats>;
  fork(outputPath: string): Promise<string>;
  pruneContextFiles(options: { olderThanDays: number }): Promise<PruneContextFilesReport>;
  shutdown(): Promise<ShutdownReport>;
}

export interface CreateMemoryResult {
  memory: Memory;
  startupStats: MemoryStats;
}

export const DEFAULT_MAX_TOKENS = 100_000;
export const HOURS_PER_DAY = 24;
export const SECONDS_PER_MINUTE = 60;
export const MINUTES_PER_HOUR = 60;
export const MS_PER_SECOND = 1000;
