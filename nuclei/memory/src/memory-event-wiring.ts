import type { EntityExtractionProcess } from '@neurome/perirhinal';

import type { MemoryEventEmitter } from './memory-events.js';
import type { AmygdalaStats, HippocampusStats, PerirhinalStats } from './memory-stats.js';
import type { PendingConsolidationStore } from './pending-consolidation-store.js';

export interface WireMemoryEventsOptions {
  events: MemoryEventEmitter;
  amygdalaStats: AmygdalaStats;
  hippocampusStats: HippocampusStats;
  pendingStore: PendingConsolidationStore;
  perirhinalProcess?: EntityExtractionProcess;
  setPerirhinalStats: (stats: PerirhinalStats) => void;
  getPerirhinalStats: () => PerirhinalStats;
}

export function wireMemoryEvents({
  events,
  amygdalaStats,
  hippocampusStats,
  pendingStore,
  perirhinalProcess,
  setPerirhinalStats,
  getPerirhinalStats,
}: WireMemoryEventsOptions): void {
  events.on('amygdala:cycle:start', ({ startedAt }) => {
    amygdalaStats.lastCycleStartedAt = startedAt;
  });

  events.on(
    'amygdala:cycle:end',
    ({ durationMs, processed, failures, llmCalls, estimatedTokens }) => {
      amygdalaStats.lastCycleDurationMs = durationMs;
      amygdalaStats.lastCycleInsightsProcessed = processed;
      amygdalaStats.lastCycleFailures = failures;
      amygdalaStats.sessionTotalLlmCalls += llmCalls;
      amygdalaStats.sessionEstimatedTokens += estimatedTokens;
    },
  );

  events.on('hippocampus:consolidation:end', ({ clustersConsolidated, recordsPruned }) => {
    hippocampusStats.lastConsolidationAt = new Date();
    hippocampusStats.lastRunClustersConsolidated = clustersConsolidated;
    hippocampusStats.lastRunRecordsPruned = recordsPruned;
  });

  events.on('hippocampus:false-memory-risk', (payload) => {
    hippocampusStats.falseMemoryCandidates += 1;
    pendingStore.add({ ...payload, createdAt: new Date() });
  });

  if (perirhinalProcess) {
    events.on('amygdala:cycle:end', () => {
      void perirhinalProcess.run().match(
        (stats) => {
          setPerirhinalStats(stats);
          events.emit('perirhinal:extraction:end', { stats });
        },
        (error) => {
          events.emit('perirhinal:extraction:end', {
            stats: getPerirhinalStats(),
            errorType: error.type,
          });
        },
      );
    });
  }
}
