import type { LLMAdapter } from '@memex/llm';
import type { LtmEngine } from '@memex/ltm';
import type { InsightLog } from '@memex/stm';

import { deleteContextFiles } from './context-file-cleanup.js';
import type { ConsolidationResult } from './hippocampus-schema.js';
import { consolidationSchema, SYSTEM_PROMPT } from './hippocampus-schema.js';
import { splitByTemporalProximity } from './temporal-split.js';

export type { ConsolidationResult } from './hippocampus-schema.js';

export interface EventBus {
  emit(event: string, payload?: unknown): unknown;
  on(event: string, listener: (...arguments_: unknown[]) => void): unknown;
}

export interface HippocampusConfig {
  ltm: LtmEngine;
  llmAdapter: LLMAdapter;
  scheduleMs?: number;
  similarityThreshold?: number;
  minClusterSize?: number;
  minAccessCount?: number;
  maxLLMCallsPerHour?: number;
  maxCreatedAtSpreadDays?: number | undefined;
  events?: EventBus;
  contextDir?: string;
  stm?: InsightLog;
  category?: string;
}

export interface HippocampusConsolidationEndPayload {
  runId: string;
  durationMs: number;
  clustersConsolidated: number;
  recordsPruned: number;
  contextFilesDeleted: number;
}

const SECONDS_PER_MINUTE = 60;
const MINUTES_PER_HOUR = 60;
const MS_PER_SECOND = 1000;
const HOUR_MS = SECONDS_PER_MINUTE * MINUTES_PER_HOUR * MS_PER_SECOND;
const DEFAULT_SCHEDULE_MS = HOUR_MS;
const DEFAULT_SIMILARITY_THRESHOLD = 0.85;
const DEFAULT_MIN_CLUSTER_SIZE = 3;
const DEFAULT_MIN_ACCESS_COUNT = 2;
const DEFAULT_MAX_LLM_CALLS_PER_HOUR = 200;
const DEFAULT_MAX_CREATED_AT_SPREAD_DAYS = 30;
const RETRY_DELAY_MS = 1000;
const MIN_RETENTION_FOR_PRUNE = 0.1;
const LOW_CONFIDENCE_THRESHOLD = 0.5;

interface StorageWithLock {
  acquireLock?: (p: string, ttl: number) => boolean;
  releaseLock?: (p: string) => void;
}

interface LtmWithStorage {
  storage: StorageWithLock;
}

export class HippocampusProcess {
  private ltm: LtmEngine;
  private llmAdapter: LLMAdapter;
  private scheduleMs: number;
  private similarityThreshold: number;
  private minClusterSize: number;
  private minAccessCount: number;
  private maxLLMCallsPerHour: number;
  private maxCreatedAtSpreadDays: number | undefined;
  private events: EventBus;
  private contextDir: string | undefined;
  private stm: InsightLog | undefined;
  private category: string | undefined;
  private intervalId: ReturnType<typeof setInterval> | undefined;
  private llmCallsThisHour: number;
  private hourWindowStart: number;

  constructor(config: HippocampusConfig) {
    this.ltm = config.ltm;
    this.llmAdapter = config.llmAdapter;
    this.scheduleMs = config.scheduleMs ?? DEFAULT_SCHEDULE_MS;
    this.similarityThreshold = config.similarityThreshold ?? DEFAULT_SIMILARITY_THRESHOLD;
    this.minClusterSize = config.minClusterSize ?? DEFAULT_MIN_CLUSTER_SIZE;
    this.minAccessCount = config.minAccessCount ?? DEFAULT_MIN_ACCESS_COUNT;
    this.maxLLMCallsPerHour = config.maxLLMCallsPerHour ?? DEFAULT_MAX_LLM_CALLS_PER_HOUR;
    this.maxCreatedAtSpreadDays =
      'maxCreatedAtSpreadDays' in config
        ? config.maxCreatedAtSpreadDays
        : DEFAULT_MAX_CREATED_AT_SPREAD_DAYS;
    this.events = config.events ?? { emit: () => false, on: () => false };
    this.contextDir = config.contextDir;
    this.stm = config.stm;
    this.category = config.category;
    this.llmCallsThisHour = 0;
    this.hourWindowStart = Date.now();
  }

  start(): void {
    this.intervalId = setInterval(() => {
      this.run().catch((error: unknown) => {
        const message = error instanceof Error ? error.message : String(error);
        process.stderr.write(`[hippocampus] consolidation cycle failed: ${message}\n`);
      });
    }, this.scheduleMs);
  }

  stop(): void {
    if (this.intervalId !== undefined) {
      clearInterval(this.intervalId);
      this.intervalId = undefined;
    }
  }

  async run(): Promise<void> {
    const runId = `${Date.now().toString()}-${Math.random().toString(36).slice(2)}`;
    const startTime = Date.now();

    const { storage } = this.ltm as unknown as LtmWithStorage;
    const acquired = storage.acquireLock?.('hippocampus', this.scheduleMs * 2) ?? true;
    if (!acquired) {
      return;
    }

    this.resetHourWindowIfNeeded();

    if (this.llmCallsThisHour >= this.maxLLMCallsPerHour) {
      storage.releaseLock?.('hippocampus');
      return;
    }

    this.events.emit('hippocampus:consolidation:start');

    let clustersConsolidated = 0;
    let recordsPruned = 0;
    let contextFilesDeleted = 0;

    try {
      clustersConsolidated = await this.consolidationPass();
      const pruneResult = this.ltm.prune({ minRetention: MIN_RETENTION_FOR_PRUNE });
      recordsPruned = pruneResult.pruned;
      contextFilesDeleted = await deleteContextFiles({
        stm: this.stm,
        contextDir: this.contextDir,
      });
    } finally {
      storage.releaseLock?.('hippocampus');
      this.events.emit('hippocampus:consolidation:end', {
        runId,
        durationMs: Date.now() - startTime,
        clustersConsolidated,
        recordsPruned,
        contextFilesDeleted,
      } satisfies HippocampusConsolidationEndPayload);
    }
  }

  private resetHourWindowIfNeeded(): void {
    const now = Date.now();
    if (now - this.hourWindowStart >= HOUR_MS) {
      this.llmCallsThisHour = 0;
      this.hourWindowStart = now;
    }
  }

  private async consolidationPass(): Promise<number> {
    const rawClusters = this.ltm.findConsolidationCandidates({
      similarityThreshold: this.similarityThreshold,
      minAccessCount: this.minAccessCount,
    });

    const clusters = rawClusters.flatMap((cluster) =>
      splitByTemporalProximity(cluster, this.maxCreatedAtSpreadDays),
    );

    let consolidated = 0;

    for (const cluster of clusters) {
      if (cluster.length < this.minClusterSize) {
        continue;
      }

      const result = await this.consolidateWithRetry(this.buildUserTurn(cluster));
      if (!result) {
        continue;
      }

      const sourceIds = cluster.map((record) => record.id);
      const consolidateOk = await this.ltm
        .consolidate(sourceIds, {
          data: result.summary,
          options: {
            deflateSourceStability: true,
            confidence: result.confidence,
            preservedFacts: result.preservedFacts,
            uncertainties: result.uncertainties,
            ...(this.category !== undefined && { category: this.category }),
          },
        })
        .match(
          (id) => ({ id }),
          () => false as const,
        );

      if (!consolidateOk) {
        continue;
      }

      const newId = consolidateOk.id;

      if (result.confidence < LOW_CONFIDENCE_THRESHOLD) {
        this.events.emit('hippocampus:false-memory-risk', {
          recordId: newId,
          confidence: result.confidence,
          sourceIds,
        });
      }

      consolidated++;
    }

    return consolidated;
  }

  private async consolidateWithRetry(userTurn: string): Promise<ConsolidationResult | undefined> {
    for (let attempt = 0; attempt <= 1; attempt++) {
      const resultAsync = this.llmAdapter.completeStructured<ConsolidationResult>({
        prompt: userTurn,
        schema: consolidationSchema,
        options: { systemPrompt: SYSTEM_PROMPT },
      });
      const result = await resultAsync.match(
        (value) => value,
        () => undefined as ConsolidationResult | undefined,
      );

      this.llmCallsThisHour++;
      if (result !== undefined) {
        return result;
      }
      if (attempt === 0) {
        await this.delay(RETRY_DELAY_MS);
      }
    }
    return undefined;
  }

  private buildUserTurn(cluster: { data: string; createdAt: Date; stability: number }[]): string {
    const lines: string[] = [`Episodic Cluster (${cluster.length.toString()} records):`];
    for (const [index, record] of cluster.entries()) {
      lines.push(
        `--- Episode ${(index + 1).toString()} ---`,
        `Recorded: ${record.createdAt.toISOString()}`,
        `Stability: ${record.stability.toString()}`,
        `Content: ${record.data}`,
      );
    }
    lines.push('Consolidate these episodes into a single semantic memory.');
    return lines.join('\n');
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
