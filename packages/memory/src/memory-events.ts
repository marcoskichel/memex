export interface MemoryEvents {
  'amygdala:cycle:start': [payload: { cycleId: string; pendingCount: number; startedAt: Date }];
  'amygdala:cycle:end': [
    payload: {
      cycleId: string;
      durationMs: number;
      processed: number;
      failures: number;
      llmCalls: number;
      estimatedTokens: number;
    },
  ];
  'amygdala:entry:scored': [
    payload: {
      insightId: string;
      action: string;
      importanceScore: number;
      relatedToId?: number;
      edgeType?: string;
    },
  ];
  'hippocampus:consolidation:start': [payload: { runId: string; startedAt: Date }];
  'hippocampus:consolidation:end': [
    payload: {
      runId: string;
      durationMs: number;
      clustersConsolidated: number;
      recordsPruned: number;
      contextFilesDeleted: number;
    },
  ];
  'hippocampus:false-memory-risk': [
    payload: {
      pendingId: string;
      summary: string;
      confidence: number;
      sourceIds: number[];
      preservedFacts: string[];
      uncertainties: string[];
    },
  ];
  'ltm:record:decayed-below-threshold': [
    payload: {
      recordId: number;
      retention: number;
      stability: number;
      lastAccessedAt: Date;
    },
  ];
  'ltm:prune:executed': [payload: { removedCount: number; removedIds: number[] }];
  'stm:compression:triggered': [
    payload: {
      contextUsagePercent: number;
      tokenCount: number;
      maxTokens: number;
      phaseId: string;
    },
  ];
}

type Listener<T extends unknown[]> = (...arguments_: T) => void;

export class MemoryEventEmitter {
  private listeners = new Map<string, Listener<unknown[]>[]>();

  emit<K extends keyof MemoryEvents>(event: K, ...arguments_: MemoryEvents[K]): boolean {
    const handlers = this.listeners.get(event) ?? [];
    for (const handler of handlers) {
      handler(...arguments_);
    }
    return handlers.length > 0;
  }

  on<K extends keyof MemoryEvents>(
    event: K,
    listener: (...arguments_: MemoryEvents[K]) => void,
  ): this {
    const existing = this.listeners.get(event) ?? [];
    this.listeners.set(event, [...existing, listener as Listener<unknown[]>]);
    return this;
  }

  off<K extends keyof MemoryEvents>(
    event: K,
    listener: (...arguments_: MemoryEvents[K]) => void,
  ): this {
    const existing = this.listeners.get(event) ?? [];
    this.listeners.set(
      event,
      existing.filter((handler) => handler !== listener),
    );
    return this;
  }

  once<K extends keyof MemoryEvents>(
    event: K,
    listener: (...arguments_: MemoryEvents[K]) => void,
  ): this {
    const wrapper = (...arguments_: MemoryEvents[K]) => {
      listener(...arguments_);
      this.off(event, wrapper);
    };
    return this.on(event, wrapper);
  }
}
