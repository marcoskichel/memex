export interface LtmStats {
  totalRecords: number;
  episodicCount: number;
  semanticCount: number;
  tombstonedCount: number;
  averageRetention: number;
  belowThresholdCount: number;
  totalEdges: number;
  averageEdgeRetention: number;
}

export interface StmStats {
  pendingInsights: number;
  averageInsightAgeMs: number;
  oldestInsightAgeMs: number;
}

export interface AmygdalaStats {
  lastCycleStartedAt: Date | undefined;
  lastCycleDurationMs: number | undefined;
  lastCycleInsightsProcessed: number;
  lastCycleFailures: number;
  sessionTotalLlmCalls: number;
  sessionEstimatedTokens: number;
}

export interface HippocampusStats {
  lastConsolidationAt: Date | undefined;
  lastRunClustersConsolidated: number;
  lastRunRecordsPruned: number;
  falseMemoryCandidates: number;
  nextScheduledRunAt: Date | undefined;
}

export interface DiskStats {
  contextFilesOnDisk: number;
  contextTotalBytes: number;
  oldestContextFileAgeMs: number | undefined;
  contextDirectory: string;
}

import type { PerirhinalStats } from '@neurome/perirhinal';

export interface MemoryStats {
  capturedAt: Date;
  engramId: string;
  ltm: LtmStats;
  stm: StmStats;
  amygdala: AmygdalaStats;
  hippocampus: HippocampusStats;
  perirhinal: PerirhinalStats;
  disk: DiskStats;
}

export { type PerirhinalStats } from '@neurome/perirhinal';
