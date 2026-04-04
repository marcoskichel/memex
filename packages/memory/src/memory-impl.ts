import { readdir, stat } from 'node:fs/promises';
import path from 'node:path';

import type { AmygdalaProcess } from '@neurokit/amygdala';
import type { HippocampusProcess } from '@neurokit/hippocampus';
import type { LtmEngine, LtmQueryOptions } from '@neurokit/ltm';
import type { InsightLog } from '@neurokit/stm';

import type { MemoryEventEmitter } from './memory-events.js';
import type { AmygdalaStats, HippocampusStats, MemoryStats } from './memory-stats.js';
import type {
  LogInsightOptions,
  Memory,
  PruneContextFilesReport,
  ShutdownReport,
} from './memory-types.js';
import {
  HOURS_PER_DAY,
  MINUTES_PER_HOUR,
  MS_PER_SECOND,
  SECONDS_PER_MINUTE,
} from './memory-types.js';

export interface MemoryImplDeps {
  sessionId: string;
  events: MemoryEventEmitter;
  ltm: LtmEngine;
  stm: InsightLog;
  amygdala: AmygdalaProcess;
  hippocampus: HippocampusProcess;
  contextDirectory: string;
}

export class MemoryImpl implements Memory {
  readonly sessionId: string;
  readonly events: MemoryEventEmitter;

  private ltm: LtmEngine;
  private stm: InsightLog;
  private amygdala: AmygdalaProcess;
  private hippocampus: HippocampusProcess;
  private contextDirectory: string;
  private isShuttingDown = false;

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

    this.events.on('hippocampus:false-memory-risk', () => {
      this.hippocampusStats.falseMemoryCandidates += 1;
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
    const cutoffMs =
      options.olderThanDays * HOURS_PER_DAY * SECONDS_PER_MINUTE * MINUTES_PER_HOUR * MS_PER_SECOND;
    const now = Date.now();
    const pendingFiles = new Set(this.stm.readUnprocessed().map((entry) => entry.contextFile));
    const report: PruneContextFilesReport = {
      deletedCount: 0,
      deletedBytes: 0,
      skippedCount: 0,
      errors: [],
    };

    const entries = await readdir(this.contextDirectory).catch(() => [] as string[]);

    const { unlink } = await import('node:fs/promises');

    for (const entry of entries) {
      const filePath = path.join(this.contextDirectory, entry);
      if (pendingFiles.has(filePath)) {
        report.skippedCount++;
        continue;
      }

      const fileStat = await stat(filePath).catch((error: unknown) => {
        report.errors.push({ path: filePath, error: String(error) });
        return;
      });
      if (fileStat === undefined) {
        continue;
      }

      if (now - fileStat.mtimeMs < cutoffMs) {
        report.skippedCount++;
        continue;
      }

      await unlink(filePath).then(
        () => {
          report.deletedCount++;
          report.deletedBytes += fileStat.size;
        },
        (error: unknown) => {
          report.errors.push({ path: filePath, error: String(error) });
        },
      );
    }

    return report;
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
    let contextFilesOnDisk = 0;
    let contextTotalBytes = 0;
    let oldestMtimeMs: number | undefined;

    const entries = await readdir(this.contextDirectory).catch(() => [] as string[]);
    for (const entry of entries) {
      const fileStat = await stat(path.join(this.contextDirectory, entry)).catch(
        () => false as const,
      );
      if (fileStat && fileStat.isFile()) {
        contextFilesOnDisk++;
        contextTotalBytes += fileStat.size;
        if (oldestMtimeMs === undefined || fileStat.mtimeMs < oldestMtimeMs) {
          oldestMtimeMs = fileStat.mtimeMs;
        }
      }
    }

    return {
      contextFilesOnDisk,
      contextTotalBytes,
      oldestContextFileAgeMs: oldestMtimeMs === undefined ? undefined : Date.now() - oldestMtimeMs,
      contextDirectory: this.contextDirectory,
    };
  }
}
