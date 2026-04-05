import type { LtmRecord } from '@neurokit/ltm';
import { errAsync, okAsync } from 'neverthrow';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { EventBus } from '../hippocampus-process.js';
import { HippocampusProcess } from '../hippocampus-process.js';

function makeRecord(id: number, overrides: Partial<LtmRecord> = {}): LtmRecord {
  return {
    id,
    data: `record ${id.toString()}`,
    metadata: {},
    embedding: new Float32Array([0.1, 0.2]),
    embeddingMeta: { modelId: 'test', dimensions: 2 },
    tier: 'episodic',
    importance: 0,
    stability: 1,
    lastAccessedAt: new Date('2024-01-01'),
    accessCount: 5,
    createdAt: new Date('2024-01-01'),
    tombstoned: false,
    tombstonedAt: undefined,
    sessionId: 'legacy',
    ...overrides,
  };
}

function makeLtm(clusters: LtmRecord[][] = []) {
  return {
    storage: {
      acquireLock: vi.fn().mockReturnValue(true),
      releaseLock: vi.fn(),
    },
    findConsolidationCandidates: vi.fn().mockReturnValue(clusters),
    consolidate: vi.fn().mockResolvedValue(99),
    prune: vi.fn().mockReturnValue({ pruned: 2, remaining: 10 }),
  };
}

const DEFAULT_LLM_RESULT = {
  summary: 'summary',
  confidence: 0.9,
  preservedFacts: ['f1'],
  uncertainties: [],
};

function makeLlmAdapter(
  result: {
    summary: string;
    confidence: number;
    preservedFacts: string[];
    uncertainties: string[];
  } = DEFAULT_LLM_RESULT,
) {
  return {
    complete: vi.fn(),
    completeStructured: vi.fn().mockReturnValue(okAsync(result)),
  };
}

function makeEventBus(): EventBus & {
  listeners: Map<string, ((...arguments_: unknown[]) => void)[]>;
} {
  const listeners = new Map<string, ((...arguments_: unknown[]) => void)[]>();
  return {
    listeners,
    emit(event: string, payload?: unknown): boolean {
      const handlers = listeners.get(event) ?? [];
      for (const handler of handlers) {
        handler(payload);
      }
      return handlers.length > 0;
    },
    on(event: string, listener: (...arguments_: unknown[]) => void) {
      const existing = listeners.get(event) ?? [];
      listeners.set(event, [...existing, listener]);
      return this;
    },
  };
}

function makeRecordAt(id: number, date: Date): LtmRecord {
  return makeRecord(id, { createdAt: date });
}

describe('HippocampusProcess', () => {
  let events: ReturnType<typeof makeEventBus>;

  beforeEach(() => {
    events = makeEventBus();
  });

  it('calls findConsolidationCandidates with correct params', async () => {
    const ltm = makeLtm([]);
    const llmAdapter = makeLlmAdapter();
    const process = new HippocampusProcess({
      ltm: ltm as never,
      llmAdapter,
      similarityThreshold: 0.85,
      minAccessCount: 2,
      events,
    });
    await process.run();
    expect(ltm.findConsolidationCandidates).toHaveBeenCalledWith({
      similarityThreshold: 0.85,
      minAccessCount: 2,
    });
  });

  it('skips clusters below minClusterSize without LLM call', async () => {
    const cluster = [makeRecord(1), makeRecord(2)];
    const ltm = makeLtm([cluster]);
    const llmAdapter = makeLlmAdapter();
    const process = new HippocampusProcess({
      ltm: ltm as never,
      llmAdapter,
      minClusterSize: 3,
      events,
    });
    await process.run();
    expect(llmAdapter.completeStructured).not.toHaveBeenCalled();
    expect(ltm.consolidate).not.toHaveBeenCalled();
  });

  it('qualifying cluster triggers LLM call and ltm.consolidate with confidence forwarded', async () => {
    const cluster = [makeRecord(1), makeRecord(2), makeRecord(3)];
    const ltm = makeLtm([cluster]);
    const llmAdapter = makeLlmAdapter({
      summary: 'merged',
      confidence: 0.8,
      preservedFacts: ['fact'],
      uncertainties: [],
    });
    const process = new HippocampusProcess({
      ltm: ltm as never,
      llmAdapter,
      minClusterSize: 3,
      events,
    });
    await process.run();
    expect(llmAdapter.completeStructured).toHaveBeenCalledOnce();
    expect(ltm.consolidate).toHaveBeenCalledWith(
      [1, 2, 3],
      expect.objectContaining({
        data: 'merged',
        options: expect.objectContaining({ deflateSourceStability: true, confidence: 0.8 }),
      }),
    );
  });

  it('retries once on LLM failure; succeeds on retry', async () => {
    const cluster = [makeRecord(1), makeRecord(2), makeRecord(3)];
    const ltm = makeLtm([cluster]);
    const llmAdapter = {
      complete: vi.fn(),
      completeStructured: vi
        .fn()
        .mockReturnValueOnce(errAsync({ type: 'UNEXPECTED_RESPONSE' as const }))
        .mockReturnValueOnce(
          okAsync({
            summary: 's',
            confidence: 0.9,
            preservedFacts: [],
            uncertainties: [],
          }),
        ),
    };
    const process = new HippocampusProcess({
      ltm: ltm as never,
      llmAdapter,
      minClusterSize: 3,
      events,
    });
    await process.run();
    expect(llmAdapter.completeStructured).toHaveBeenCalledTimes(2);
    expect(ltm.consolidate).toHaveBeenCalledOnce();
  });

  it('skips cluster when both LLM attempts fail', async () => {
    const cluster = [makeRecord(1), makeRecord(2), makeRecord(3)];
    const ltm = makeLtm([cluster]);
    const llmAdapter = {
      complete: vi.fn(),
      completeStructured: vi
        .fn()
        .mockReturnValue(errAsync({ type: 'UNEXPECTED_RESPONSE' as const })),
    };
    const process = new HippocampusProcess({
      ltm: ltm as never,
      llmAdapter,
      minClusterSize: 3,
      events,
    });
    await process.run();
    expect(llmAdapter.completeStructured).toHaveBeenCalledTimes(2);
    expect(ltm.consolidate).not.toHaveBeenCalled();
  });

  it('always calls prune after consolidation pass completes', async () => {
    const ltm = makeLtm([]);
    const llmAdapter = makeLlmAdapter();
    const process = new HippocampusProcess({ ltm: ltm as never, llmAdapter, events });
    await process.run();
    expect(ltm.prune).toHaveBeenCalledWith({ minRetention: 0.1 });
  });

  it('does not call prune if consolidation pass throws unrecovered error', async () => {
    const ltm = makeLtm([]);
    ltm.findConsolidationCandidates.mockImplementation(() => {
      throw new Error('storage failure');
    });
    const llmAdapter = makeLlmAdapter();
    const process = new HippocampusProcess({ ltm: ltm as never, llmAdapter, events });
    await expect(process.run()).rejects.toThrow('storage failure');
    expect(ltm.prune).not.toHaveBeenCalled();
  });

  it('emits false-memory-risk when confidence < 0.5', async () => {
    const cluster = [makeRecord(1), makeRecord(2), makeRecord(3)];
    const ltm = makeLtm([cluster]);
    ltm.consolidate.mockResolvedValue(42);
    const llmAdapter = makeLlmAdapter({
      summary: 's',
      confidence: 0.4,
      preservedFacts: [],
      uncertainties: ['u1'],
    });
    const process = new HippocampusProcess({
      ltm: ltm as never,
      llmAdapter,
      minClusterSize: 3,
      events,
    });

    const riskPayloads: unknown[] = [];
    events.on('hippocampus:false-memory-risk', (payload) => riskPayloads.push(payload));

    await process.run();
    expect(riskPayloads).toHaveLength(1);
    expect(riskPayloads[0]).toMatchObject({ recordId: 42, confidence: 0.4, sourceIds: [1, 2, 3] });
  });

  it('does not emit false-memory-risk when confidence >= 0.5', async () => {
    const cluster = [makeRecord(1), makeRecord(2), makeRecord(3)];
    const ltm = makeLtm([cluster]);
    const llmAdapter = makeLlmAdapter({
      summary: 's',
      confidence: 0.7,
      preservedFacts: [],
      uncertainties: [],
    });
    const process = new HippocampusProcess({
      ltm: ltm as never,
      llmAdapter,
      minClusterSize: 3,
      events,
    });

    const riskPayloads: unknown[] = [];
    events.on('hippocampus:false-memory-risk', (payload) => riskPayloads.push(payload));

    await process.run();
    expect(riskPayloads).toHaveLength(0);
  });

  it('is idempotent: second run with no new candidates produces no additional consolidations', async () => {
    const ltm = makeLtm([]);
    const llmAdapter = makeLlmAdapter();
    const process = new HippocampusProcess({ ltm: ltm as never, llmAdapter, events });
    await process.run();
    await process.run();
    expect(ltm.consolidate).not.toHaveBeenCalled();
  });

  it('skips full cycle if lock cannot be acquired', async () => {
    const ltm = makeLtm([]);
    ltm.storage.acquireLock.mockReturnValue(false);
    const llmAdapter = makeLlmAdapter();
    const process = new HippocampusProcess({ ltm: ltm as never, llmAdapter, events });
    await process.run();
    expect(ltm.findConsolidationCandidates).not.toHaveBeenCalled();
    expect(ltm.prune).not.toHaveBeenCalled();
  });

  it('releases lock after consolidation pass completes', async () => {
    const ltm = makeLtm([]);
    const llmAdapter = makeLlmAdapter();
    const process = new HippocampusProcess({ ltm: ltm as never, llmAdapter, events });
    await process.run();
    expect(ltm.storage.releaseLock).toHaveBeenCalledWith('hippocampus');
  });

  it('releases lock even when consolidation throws', async () => {
    const ltm = makeLtm([]);
    ltm.findConsolidationCandidates.mockImplementation(() => {
      throw new Error('fail');
    });
    const llmAdapter = makeLlmAdapter();
    const process = new HippocampusProcess({ ltm: ltm as never, llmAdapter, events });
    await expect(process.run()).rejects.toThrow();
    expect(ltm.storage.releaseLock).toHaveBeenCalledWith('hippocampus');
  });

  it('emits consolidation:start before any ltm.consolidate call', async () => {
    const cluster = [makeRecord(1), makeRecord(2), makeRecord(3)];
    const ltm = makeLtm([cluster]);
    const llmAdapter = makeLlmAdapter();
    const order: string[] = [];
    events.on('hippocampus:consolidation:start', () => order.push('start'));
    ltm.consolidate.mockImplementation(() => {
      order.push('consolidate');
      return Promise.resolve(1);
    });
    const process = new HippocampusProcess({
      ltm: ltm as never,
      llmAdapter,
      minClusterSize: 3,
      events,
    });
    await process.run();
    expect(order.indexOf('start')).toBeLessThan(order.indexOf('consolidate'));
  });

  it('emits consolidation:end with accurate counts', async () => {
    const cluster = [makeRecord(1), makeRecord(2), makeRecord(3)];
    const ltm = makeLtm([cluster]);
    ltm.prune.mockReturnValue({ pruned: 5, remaining: 3 });
    const llmAdapter = makeLlmAdapter();
    const process = new HippocampusProcess({
      ltm: ltm as never,
      llmAdapter,
      minClusterSize: 3,
      events,
    });

    let endPayload: Record<string, unknown> | undefined;
    events.on('hippocampus:consolidation:end', (payload) => {
      endPayload = payload as Record<string, unknown>;
    });

    await process.run();
    expect(endPayload).toMatchObject({ clustersConsolidated: 1, recordsPruned: 5 });
  });

  it('defers consolidation cycle when maxLLMCallsPerHour is exhausted', async () => {
    const cluster = [makeRecord(1), makeRecord(2), makeRecord(3)];
    const ltm = makeLtm([cluster]);
    const llmAdapter = makeLlmAdapter();
    const process = new HippocampusProcess({
      ltm: ltm as never,
      llmAdapter,
      maxLLMCallsPerHour: 0,
      events,
    });
    await process.run();
    expect(ltm.findConsolidationCandidates).not.toHaveBeenCalled();
    expect(ltm.prune).not.toHaveBeenCalled();
  });

  it('4.1 consolidated record has category matching HippocampusConfig.category', async () => {
    const cluster = [makeRecord(1), makeRecord(2), makeRecord(3)];
    const ltm = makeLtm([cluster]);
    const llmAdapter = makeLlmAdapter();
    const process = new HippocampusProcess({
      ltm: ltm as never,
      llmAdapter,
      minClusterSize: 3,
      events,
      category: 'agent_belief',
    });
    await process.run();
    expect(ltm.consolidate).toHaveBeenCalledWith(
      [1, 2, 3],
      expect.objectContaining({
        options: expect.objectContaining({ category: 'agent_belief' }),
      }),
    );
  });

  it('4.2 consolidated record has no category when config omits it', async () => {
    const cluster = [makeRecord(1), makeRecord(2), makeRecord(3)];
    const ltm = makeLtm([cluster]);
    const llmAdapter = makeLlmAdapter();
    const process = new HippocampusProcess({
      ltm: ltm as never,
      llmAdapter,
      minClusterSize: 3,
      events,
    });
    await process.run();
    expect(ltm.consolidate).toHaveBeenCalledWith(
      [1, 2, 3],
      expect.objectContaining({
        options: expect.not.objectContaining({ category: expect.anything() }),
      }),
    );
  });

  it('4.3 safeToDelete=true context files are deleted without LTM query', async () => {
    const { InsightLog } = await import('@neurokit/stm');
    const stm = new InsightLog();
    const ltm = makeLtm([]);
    const llmAdapter = makeLlmAdapter();

    const temporaryFile = `/tmp/hippocampus-test-${Date.now().toString()}.txt`;
    const { promises: fs } = await import('node:fs');
    await fs.writeFile(temporaryFile, 'context');

    stm.append({ summary: 'test', contextFile: temporaryFile, tags: [], safeToDelete: true });

    const process = new HippocampusProcess({
      ltm: ltm as never,
      llmAdapter,
      events,
      stm,
    });
    await process.run();

    await expect(fs.access(temporaryFile)).rejects.toThrow();
  });

  it('4.4 safeToDelete=false context files are not deleted', async () => {
    const { InsightLog } = await import('@neurokit/stm');
    const stm = new InsightLog();
    const ltm = makeLtm([]);
    const llmAdapter = makeLlmAdapter();

    const temporaryFile = `/tmp/hippocampus-test-nodelet-${Date.now().toString()}.txt`;
    const { promises: fs } = await import('node:fs');
    await fs.writeFile(temporaryFile, 'context');

    stm.append({ summary: 'test', contextFile: temporaryFile, tags: [], safeToDelete: false });

    const process = new HippocampusProcess({
      ltm: ltm as never,
      llmAdapter,
      events,
      stm,
    });
    await process.run();

    await expect(fs.access(temporaryFile)).resolves.toBeUndefined();
    await fs.unlink(temporaryFile);
  });

  describe('temporal proximity splitting', () => {
    it('cohesive cluster within threshold is not split', async () => {
      const base = new Date('2024-01-01');
      const cluster = [
        makeRecordAt(1, new Date(base.getTime() + 0)),
        makeRecordAt(2, new Date(base.getTime() + 3 * 86_400_000)),
        makeRecordAt(3, new Date(base.getTime() + 8 * 86_400_000)),
        makeRecordAt(4, new Date(base.getTime() + 10 * 86_400_000)),
      ];
      const ltm = makeLtm([cluster]);
      const llmAdapter = makeLlmAdapter();
      const process = new HippocampusProcess({
        ltm: ltm as never,
        llmAdapter,
        minClusterSize: 3,
        maxCreatedAtSpreadDays: 30,
        events,
      });
      await process.run();
      expect(llmAdapter.completeStructured).toHaveBeenCalledOnce();
    });

    it('dispersed cluster is split at the largest gap', async () => {
      const jan1 = new Date('2024-01-01').getTime();
      const jul1 = new Date('2024-07-01').getTime();
      const cluster = [
        makeRecordAt(1, new Date(jan1)),
        makeRecordAt(2, new Date(jan1 + 4 * 86_400_000)),
        makeRecordAt(3, new Date(jan1 + 7 * 86_400_000)),
        makeRecordAt(4, new Date(jul1)),
        makeRecordAt(5, new Date(jul1 + 5 * 86_400_000)),
        makeRecordAt(6, new Date(jul1 + 10 * 86_400_000)),
      ];
      const ltm = makeLtm([cluster]);
      const llmAdapter = makeLlmAdapter();
      const process = new HippocampusProcess({
        ltm: ltm as never,
        llmAdapter,
        minClusterSize: 3,
        maxCreatedAtSpreadDays: 30,
        events,
      });
      await process.run();
      expect(llmAdapter.completeStructured).toHaveBeenCalledTimes(2);
      expect(ltm.consolidate).toHaveBeenCalledTimes(2);
    });

    it('sub-cluster below minClusterSize after split is discarded', async () => {
      const jan1 = new Date('2024-01-01').getTime();
      const jul1 = new Date('2024-07-01').getTime();
      const cluster = [
        makeRecordAt(1, new Date(jan1)),
        makeRecordAt(2, new Date(jul1)),
        makeRecordAt(3, new Date(jul1 + 5 * 86_400_000)),
        makeRecordAt(4, new Date(jul1 + 10 * 86_400_000)),
      ];
      const ltm = makeLtm([cluster]);
      const llmAdapter = makeLlmAdapter();
      const process = new HippocampusProcess({
        ltm: ltm as never,
        llmAdapter,
        minClusterSize: 3,
        maxCreatedAtSpreadDays: 30,
        events,
      });
      await process.run();
      expect(llmAdapter.completeStructured).toHaveBeenCalledOnce();
      expect(ltm.consolidate).toHaveBeenCalledOnce();
    });

    it('maxCreatedAtSpreadDays undefined disables temporal splitting', async () => {
      const jan1 = new Date('2024-01-01').getTime();
      const dec31 = new Date('2024-12-31').getTime();
      const cluster = [
        makeRecordAt(1, new Date(jan1)),
        makeRecordAt(2, new Date(jan1 + 7 * 86_400_000)),
        makeRecordAt(3, new Date(dec31)),
      ];
      const ltm = makeLtm([cluster]);
      const llmAdapter = makeLlmAdapter();
      const process = new HippocampusProcess({
        ltm: ltm as never,
        llmAdapter,
        minClusterSize: 3,
        maxCreatedAtSpreadDays: undefined,
        events,
      });
      await process.run();
      expect(llmAdapter.completeStructured).toHaveBeenCalledOnce();
    });

    it('split occurs at single largest gap only', async () => {
      const base = new Date('2024-01-01').getTime();
      const cluster = [
        makeRecordAt(1, new Date(base)),
        makeRecordAt(2, new Date(base + 10 * 86_400_000)),
        makeRecordAt(3, new Date(base + 100 * 86_400_000)),
        makeRecordAt(4, new Date(base + 105 * 86_400_000)),
        makeRecordAt(5, new Date(base + 185 * 86_400_000)),
      ];
      const ltm = makeLtm([cluster]);
      const llmAdapter = makeLlmAdapter();
      const process = new HippocampusProcess({
        ltm: ltm as never,
        llmAdapter,
        minClusterSize: 2,
        maxCreatedAtSpreadDays: 30,
        events,
      });
      await process.run();
      expect(llmAdapter.completeStructured).toHaveBeenCalledTimes(2);
    });

    it('uses config maxCreatedAtSpreadDays when provided', async () => {
      const jan1 = new Date('2024-01-01').getTime();
      const jul1 = new Date('2024-07-01').getTime();
      const cluster = [
        makeRecordAt(1, new Date(jan1)),
        makeRecordAt(2, new Date(jan1 + 5 * 86_400_000)),
        makeRecordAt(3, new Date(jul1)),
        makeRecordAt(4, new Date(jul1 + 5 * 86_400_000)),
      ];
      const ltm = makeLtm([cluster]);
      const llmAdapter = makeLlmAdapter();
      const process = new HippocampusProcess({
        ltm: ltm as never,
        llmAdapter,
        minClusterSize: 2,
        maxCreatedAtSpreadDays: 60,
        events,
      });
      await process.run();
      expect(llmAdapter.completeStructured).toHaveBeenCalledTimes(2);
    });

    it('applies 30-day default when maxCreatedAtSpreadDays is not configured', async () => {
      const base = new Date('2024-01-01').getTime();
      const cluster = [
        makeRecordAt(1, new Date(base)),
        makeRecordAt(2, new Date(base + 3 * 86_400_000)),
        makeRecordAt(3, new Date(base + 45 * 86_400_000)),
        makeRecordAt(4, new Date(base + 48 * 86_400_000)),
      ];
      const ltm = makeLtm([cluster]);
      const llmAdapter = makeLlmAdapter();
      const process = new HippocampusProcess({
        ltm: ltm as never,
        llmAdapter,
        minClusterSize: 2,
        events,
      });
      await process.run();
      expect(llmAdapter.completeStructured).toHaveBeenCalledTimes(2);
    });
  });
});
