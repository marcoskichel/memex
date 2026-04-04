import type { LLMAdapter } from '@neurokit/llm';
import type { EmbeddingAdapter, LtmQueryOptions } from '@neurokit/ltm';
import type { LtmEngine } from '@neurokit/ltm';

import type { MemoryEventEmitter } from './memory-events.js';
import type { MemoryStats } from './memory-stats.js';

export type {
  AmygdalaStats,
  DiskStats,
  HippocampusStats,
  LtmStats,
  MemoryStats,
  StmStats,
} from './memory-stats.js';

export interface MemoryConfig {
  storagePath: string;
  contextDirectory?: string;
  llmAdapter: LLMAdapter;
  embeddingAdapter?: EmbeddingAdapter;
  compressionThreshold?: number;
  amygdalaCadenceMs?: number;
  hippocampusScheduleMs?: number;
  maxTokens?: number;
  maxLLMCallsPerHour?: number;
  lowCostModeThreshold?: number;
}

export interface ShutdownReport {
  sessionId: string;
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

export interface LogInsightOptions {
  summary: string;
  contextFile: string;
  tags?: string[];
}

export interface Memory {
  readonly sessionId: string;
  readonly events: MemoryEventEmitter;
  logInsight(options: LogInsightOptions): void;
  recall(nlQuery: string, options?: LtmQueryOptions): ReturnType<LtmEngine['query']>;
  getStats(): Promise<MemoryStats>;
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
