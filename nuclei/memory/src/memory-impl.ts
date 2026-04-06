import type { AgentState, AmygdalaProcess } from '@neurome/amygdala';
import type { HippocampusProcess } from '@neurome/hippocampus';
import type { LLMAdapter } from '@neurome/llm';
import type {
  LtmEngine,
  LtmInsertOptions,
  LtmQueryOptions,
  LtmQueryResult,
  LtmRecord,
} from '@neurome/ltm';
import type { InsightLogLike } from '@neurome/stm';
import { errAsync, okAsync, type ResultAsync } from 'neverthrow';

import { collectDiskStats, pruneContextFiles } from './memory-disk.js';
import type { MemoryEventEmitter } from './memory-events.js';
import { importTextImpl } from './memory-import.js';
import type { AmygdalaStats, HippocampusStats, MemoryStats } from './memory-stats.js';
import {
  DEFAULT_PENDING_CONSOLIDATION_TTL_MS,
  InsertMemoryError,
  RecordNotFoundError,
  type ImportTextError,
  type LogInsightOptions,
  type Memory,
  type PendingConsolidation,
  type PruneContextFilesReport,
  type ShutdownReport,
} from './memory-types.js';
import { PendingConsolidationStore } from './pending-consolidation-store.js';

export interface MemoryImplDeps {
  sessionId: string;
  events: MemoryEventEmitter;
  ltm: LtmEngine;
  stm: InsightLogLike;
  amygdala: AmygdalaProcess;
  hippocampus: HippocampusProcess;
  contextDirectory: string;
  llmAdapter: LLMAdapter;
  pendingConsolidationTtlMs?: number;
}

export class MemoryImpl implements Memory {
  readonly sessionId: string;
  readonly events: MemoryEventEmitter;

  private ltm: LtmEngine;
  private stm: InsightLogLike;
  private amygdala: AmygdalaProcess;
  private hippocampus: HippocampusProcess;
  private contextDirectory: string;
  private llmAdapter: LLMAdapter;
  private isShuttingDown = false;
  private pendingStore: PendingConsolidationStore;

  private amygdalaStats: AmygdalaStats = {
    lastCycleStartedAt: undefined,
    lastCycleDurationMs: undefined,
    lastCycleInsightsProcessed: 0,
    lastCycleFailures: 0,
    sessionTotalLlmCalls: 0,
    sessionEstimatedTokens: 0,
  };

  private hippocampusStats: HippocampusStats = {
    lastConsolidationAt: undefined,
    lastRunClustersConsolidated: 0,
    lastRunRecordsPruned: 0,
    falseMemoryCandidates: 0,
    nextScheduledRunAt: undefined,
  };

  constructor(deps: MemoryImplDeps) {
    this.sessionId = deps.sessionId;
    this.events = deps.events;
    this.ltm = deps.ltm;
    this.stm = deps.stm;
    this.amygdala = deps.amygdala;
    this.hippocampus = deps.hippocampus;
    this.contextDirectory = deps.contextDirectory;
    this.llmAdapter = deps.llmAdapter;
    this.pendingStore = new PendingConsolidationStore(
      deps.pendingConsolidationTtlMs ?? DEFAULT_PENDING_CONSOLIDATION_TTL_MS,
    );

    this.events.on('amygdala:cycle:start', ({ startedAt }) => {
      this.amygdalaStats.lastCycleStartedAt = startedAt;
    });

    this.events.on(
      'amygdala:cycle:end',
      ({ durationMs, processed, failures, llmCalls, estimatedTokens }) => {
        this.amygdalaStats.lastCycleDurationMs = durationMs;
        this.amygdalaStats.lastCycleInsightsProcessed = processed;
        this.amygdalaStats.lastCycleFailures = failures;
        this.amygdalaStats.sessionTotalLlmCalls += llmCalls;
        this.amygdalaStats.sessionEstimatedTokens += estimatedTokens;
      },
    );

    this.events.on('hippocampus:consolidation:end', ({ clustersConsolidated, recordsPruned }) => {
      this.hippocampusStats.lastConsolidationAt = new Date();
      this.hippocampusStats.lastRunClustersConsolidated = clustersConsolidated;
      this.hippocampusStats.lastRunRecordsPruned = recordsPruned;
    });

    this.events.on('hippocampus:false-memory-risk', (payload) => {
      this.hippocampusStats.falseMemoryCandidates += 1;
      this.pendingStore.add({ ...payload, createdAt: new Date() });
    });
  }

  logInsight(options: LogInsightOptions): void {
    if (this.isShuttingDown) {
      return;
    }
    this.stm.append({
      summary: options.summary,
      contextFile: options.contextFile,
      tags: options.tags ?? [],
    });
  }

  recall(nlQuery: string, options?: LtmQueryOptions): ReturnType<LtmEngine['query']> {
    return this.ltm.query(nlQuery, { strengthen: false, ...options });
  }

  async recallSession(
    query: string,
    options: { sessionId: string } & Omit<LtmQueryOptions, 'sessionId'>,
  ): Promise<LtmQueryResult[]> {
    const { sessionId, ...rest } = options;
    const result = await this.ltm.query(query, { strengthen: false, ...rest, sessionId });
    return result.isOk() ? result.value : [];
  }

  recallFull(
    id: number,
  ): ResultAsync<{ record: LtmRecord; episodeSummary: string | undefined }, RecordNotFoundError> {
    const raw = this.ltm.getById(id);
    if (!raw || raw.tombstoned) {
      return errAsync(new RecordNotFoundError(id));
    }
    return okAsync({ record: raw, episodeSummary: raw.episodeSummary });
  }

  insertMemory(data: string, options?: LtmInsertOptions): ResultAsync<number, InsertMemoryError> {
    return this.ltm.insert(data, options).mapErr((error) => new InsertMemoryError(error.type));
  }

  importText(text: string): ResultAsync<{ inserted: number }, ImportTextError> {
    return importTextImpl({ llmAdapter: this.llmAdapter, ltm: this.ltm }, text);
  }

  getRecent(limit: number): LtmRecord[] {
    return this.ltm.getRecent(limit);
  }

  async consolidate(): Promise<void> {
    this.pendingStore.purgeStale();
    await this.amygdala.run();
    await this.hippocampus.run();
  }

  getPendingConsolidations(): PendingConsolidation[] {
    return this.pendingStore.all();
  }

  approveConsolidation(pendingId: string): ResultAsync<number, InsertMemoryError> {
    return this.pendingStore.approve(pendingId, this.ltm);
  }

  discardConsolidation(pendingId: string): void {
    this.pendingStore.discard(pendingId);
  }

  setAgentState(state: AgentState | undefined): void {
    this.amygdala.setAgentState(state);
  }

  async getStats(): Promise<MemoryStats> {
    const ltmRaw = this.ltm.stats();
    const unprocessed = this.stm.readUnprocessed();
    const now = Date.now();
    const ages = unprocessed.map((entry) => now - entry.timestamp.getTime());
    const averageInsightAgeMs =
      ages.length > 0 ? ages.reduce((first, second) => first + second, 0) / ages.length : 0;
    const oldestInsightAgeMs = ages.length > 0 ? Math.max(...ages) : 0;
    const diskStats = await this.collectDiskStats();

    return {
      capturedAt: new Date(),
      sessionId: this.sessionId,
      ltm: {
        totalRecords: ltmRaw.total,
        episodicCount: ltmRaw.episodic,
        semanticCount: ltmRaw.semantic,
        tombstonedCount: ltmRaw.tombstoned,
        averageRetention: ltmRaw.avgRetention,
        belowThresholdCount: 0,
        totalEdges: 0,
        averageEdgeRetention: 0,
      },
      stm: { pendingInsights: unprocessed.length, averageInsightAgeMs, oldestInsightAgeMs },
      amygdala: { ...this.amygdalaStats },
      hippocampus: { ...this.hippocampusStats },
      disk: diskStats,
    };
  }

  async pruneContextFiles(options: { olderThanDays: number }): Promise<PruneContextFilesReport> {
    return pruneContextFiles(this.contextDirectory, { stm: this.stm, options });
  }

  async shutdown(): Promise<ShutdownReport> {
    const startedAt = Date.now();
    this.isShuttingDown = true;
    const pendingBefore = this.stm.readUnprocessed().length;
    await this.amygdala.run();
    this.hippocampus.stop();
    this.amygdala.stop();
    const ltmStats = this.ltm.stats();
    const diskStats = await this.collectDiskStats();

    return {
      sessionId: this.sessionId,
      shutdownAt: new Date(),
      durationMs: Date.now() - startedAt,
      stmPhasesCompressed: 0,
      insightsDrained: pendingBefore,
      hippocampusCycleWaitedMs: undefined,
      ltmRecordsAtClose: ltmStats.total,
      contextFilesRemainingOnDisk: diskStats.contextFilesOnDisk,
    };
  }

  private async collectDiskStats() {
    return collectDiskStats(this.contextDirectory);
  }
}
