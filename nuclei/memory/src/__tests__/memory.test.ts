import type { ExtractionError, PerirhinalStats } from '@neurome/perirhinal';
import type { ResultAsync } from 'neverthrow';
import { errAsync, okAsync } from 'neverthrow';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { MemoryEventEmitter } from '../memory-events.js';
import { RecordNotFoundError } from '../memory-types.js';
import { createMemory } from '../memory.js';

const mockStmAppend = vi.fn();
const mockStmReadUnprocessed = vi.fn(() => []);
const mockStmMarkProcessed = vi.fn();

const mockLtmQuery = vi.fn(() => ({ isOk: () => true, value: [] }));
const mockLtmGetById = vi.fn();
function makeOkResult<T>(value: T) {
  const result = {
    isOk: (): boolean => true,
    isErr: (): boolean => false,
    value,
    error: undefined as { type: string } | undefined,
    mapErr: (_function: unknown) => result,
    match: (onOk: (v: T) => unknown, _onError: unknown) => onOk(value),
  };
  return result;
}

function makeErrorResult(error: { type: string }) {
  const result = {
    isOk: (): boolean => false,
    isErr: (): boolean => true,
    value: undefined as number | undefined,
    error,
    mapErr: (function_: (error_: { type: string }) => unknown) => {
      const mapped = function_(error);
      return {
        isOk: (): boolean => false,
        isErr: (): boolean => true,
        error: mapped,
        andThen: (_function: unknown) => result,
      };
    },
    match: (_onOk: unknown, onError: (error_: { type: string }) => unknown) => onError(error),
  };
  return result;
}

const mockLtmInsert = vi.fn(() => makeOkResult(1));
const mockLtmGetRecent = vi.fn(() => [] as unknown[]);
const mockLtmStats = vi.fn(() => ({
  total: 0,
  episodic: 0,
  semantic: 0,
  tombstoned: 0,
  avgStability: 0,
  avgRetention: 0,
}));

const mockAmygdalaRun = vi.fn(() => Promise.resolve());
const mockAmygdalaStart = vi.fn();
const mockAmygdalaStop = vi.fn();

const mockHippocampusStart = vi.fn();
const mockHippocampusStop = vi.fn();

vi.mock('@neurome/ltm', () => ({
  SqliteAdapter: vi.fn(() => ({})),
  LtmEngine: vi.fn(() => ({
    query: mockLtmQuery,
    stats: mockLtmStats,
    getById: mockLtmGetById,
    insert: mockLtmInsert,
    getRecent: mockLtmGetRecent,
  })),
}));

vi.mock('@neurome/stm', () => ({
  InsightLog: vi.fn(() => ({
    append: mockStmAppend,
    readUnprocessed: mockStmReadUnprocessed,
    markProcessed: mockStmMarkProcessed,
  })),
}));

vi.mock('@neurome/amygdala', () => ({
  AmygdalaProcess: vi.fn(() => ({
    run: mockAmygdalaRun,
    start: mockAmygdalaStart,
    stop: mockAmygdalaStop,
  })),
}));

vi.mock('@neurome/hippocampus', () => ({
  HippocampusProcess: vi.fn(() => ({
    start: mockHippocampusStart,
    stop: mockHippocampusStop,
  })),
}));

const defaultPerirhinalStats = {
  recordsProcessed: 0,
  entitiesInserted: 0,
  entitiesReused: 0,
  errors: 0,
};
const mockPerirhinalRun = vi.fn(
  () => okAsync(defaultPerirhinalStats) as ResultAsync<PerirhinalStats, ExtractionError>,
);

vi.mock('@neurome/perirhinal', () => ({
  EntityExtractionProcess: vi.fn(() => ({
    run: mockPerirhinalRun,
  })),
}));

vi.mock('node:fs/promises', () => ({
  mkdir: vi.fn(() => Promise.resolve()),
  readdir: vi.fn(() => Promise.resolve([])),
  stat: vi.fn(() => Promise.resolve({ isFile: () => true, size: 0, mtimeMs: Date.now() })),
  unlink: vi.fn(() => Promise.resolve()),
}));

const mockLlmAdapter = { complete: vi.fn(), completeStructured: vi.fn() };

const mockEmbeddingAdapter = { modelId: 'mock', dimensions: 384, embed: vi.fn() };

const baseConfig = {
  storagePath: '/tmp/test.db',
  llmAdapter: mockLlmAdapter,
  embeddingAdapter: mockEmbeddingAdapter,
};

describe('createMemory', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockStmReadUnprocessed.mockReturnValue([]);
    mockLtmStats.mockReturnValue({
      total: 0,
      episodic: 0,
      semantic: 0,
      tombstoned: 0,
      avgStability: 0,
      avgRetention: 0,
    });
  });

  it('returns memory and startupStats', async () => {
    const result = await createMemory(baseConfig);
    expect(result).toHaveProperty('memory');
    expect(result).toHaveProperty('startupStats');
  });

  it('starts amygdala and hippocampus processes', async () => {
    await createMemory(baseConfig);
    expect(mockAmygdalaStart).toHaveBeenCalledOnce();
    expect(mockHippocampusStart).toHaveBeenCalledOnce();
  });

  it('memory has an engramId', async () => {
    const { memory } = await createMemory(baseConfig);
    expect(typeof memory.engramId).toBe('string');
    expect(memory.engramId).toBeTruthy();
  });

  it('memory.events is a MemoryEventEmitter', async () => {
    const { memory } = await createMemory(baseConfig);
    expect(memory.events).toBeInstanceOf(MemoryEventEmitter);
  });

  it('uses custom stm from config when provided', async () => {
    const customStmAppend = vi.fn();
    const customStm = {
      append: customStmAppend,
      readUnprocessed: vi.fn(() => []),
      markProcessed: vi.fn(),
      clear: vi.fn(),
      allEntries: vi.fn(() => []),
    };
    const { memory } = await createMemory({ ...baseConfig, stm: customStm as never });
    memory.logInsight({ summary: 'test insight', contextFile: '/tmp/test.txt' });
    expect(customStmAppend).toHaveBeenCalledWith({
      summary: 'test insight',
      contextFile: '/tmp/test.txt',
      tags: [],
    });
    expect(mockStmAppend).not.toHaveBeenCalled();
  });
});

describe('logInsight', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockStmReadUnprocessed.mockReturnValue([]);
    mockLtmStats.mockReturnValue({
      total: 0,
      episodic: 0,
      semantic: 0,
      tombstoned: 0,
      avgStability: 0,
      avgRetention: 0,
    });
  });

  it('calls stm.append with summary, contextFile, and tags', async () => {
    const { memory } = await createMemory(baseConfig);
    memory.logInsight({
      summary: 'observed X',
      contextFile: '/tmp/phase-1.txt',
      tags: ['tool-use'],
    });
    expect(mockStmAppend).toHaveBeenCalledWith({
      summary: 'observed X',
      contextFile: '/tmp/phase-1.txt',
      tags: ['tool-use'],
    });
  });

  it('defaults tags to empty array when not provided', async () => {
    const { memory } = await createMemory(baseConfig);
    memory.logInsight({ summary: 'observed X', contextFile: '/tmp/phase-1.txt' });
    expect(mockStmAppend).toHaveBeenCalledWith({
      summary: 'observed X',
      contextFile: '/tmp/phase-1.txt',
      tags: [],
    });
  });

  it('silently ignores logInsight after shutdown is called', async () => {
    const { memory } = await createMemory(baseConfig);
    await memory.shutdown();
    memory.logInsight({ summary: 'x', contextFile: '/tmp/x.txt' });
    expect(mockStmAppend).not.toHaveBeenCalled();
  });
});

describe('recall', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockStmReadUnprocessed.mockReturnValue([]);
    mockLtmStats.mockReturnValue({
      total: 0,
      episodic: 0,
      semantic: 0,
      tombstoned: 0,
      avgStability: 0,
      avgRetention: 0,
    });
  });

  it('delegates to ltm.query with strengthen: false', async () => {
    const { memory } = await createMemory(baseConfig);
    memory.recall('what did I learn about X?');
    expect(mockLtmQuery).toHaveBeenCalledWith('what did I learn about X?', {
      minResults: 1,
      strengthen: false,
    });
  });

  it('passes through additional options including strengthen override', async () => {
    const { memory } = await createMemory(baseConfig);
    memory.recall('some query', { strengthen: true, limit: 5 });
    expect(mockLtmQuery).toHaveBeenCalledWith('some query', {
      minResults: 1,
      strengthen: true,
      limit: 5,
    });
  });

  it('passes entityName filter through to ltm.query', async () => {
    const { memory } = await createMemory(baseConfig);
    memory.recall('what do I know about marcos', { entityName: 'marcos' });
    expect(mockLtmQuery).toHaveBeenCalledWith('what do I know about marcos', {
      minResults: 1,
      strengthen: false,
      entityName: 'marcos',
    });
  });

  it('passes entityType filter through to ltm.query', async () => {
    const { memory } = await createMemory(baseConfig);
    memory.recall('tools used', { entityType: 'tool' });
    expect(mockLtmQuery).toHaveBeenCalledWith('tools used', {
      minResults: 1,
      strengthen: false,
      entityType: 'tool',
    });
  });
});

describe('shutdown', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockStmReadUnprocessed.mockReturnValue([]);
    mockLtmStats.mockReturnValue({
      total: 0,
      episodic: 0,
      semantic: 0,
      tombstoned: 0,
      avgStability: 0,
      avgRetention: 0,
    });
  });

  it('calls amygdala.run() then stops both processes', async () => {
    const callOrder: string[] = [];
    mockAmygdalaRun.mockImplementation(() => {
      callOrder.push('amygdala.run');
      return Promise.resolve();
    });
    mockAmygdalaStop.mockImplementation(() => {
      callOrder.push('amygdala.stop');
    });
    mockHippocampusStop.mockImplementation(() => {
      callOrder.push('hippocampus.stop');
    });

    const { memory } = await createMemory(baseConfig);
    await memory.shutdown();

    expect(callOrder[0]).toBe('amygdala.run');
    expect(mockAmygdalaStop).toHaveBeenCalledOnce();
    expect(mockHippocampusStop).toHaveBeenCalledOnce();
  });

  it('returns a ShutdownReport with correct shape', async () => {
    const { memory } = await createMemory(baseConfig);
    const report = await memory.shutdown();

    expect(report).toHaveProperty('engramId');
    expect(report).toHaveProperty('shutdownAt');
    expect(report).toHaveProperty('durationMs');
    expect(report).toHaveProperty('stmPhasesCompressed');
    expect(report).toHaveProperty('insightsDrained');
    expect(report).toHaveProperty('hippocampusCycleWaitedMs');
    expect(report).toHaveProperty('ltmRecordsAtClose');
    expect(report).toHaveProperty('contextFilesRemainingOnDisk');
  });
});

describe('getStats', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockStmReadUnprocessed.mockReturnValue([]);
    mockLtmStats.mockReturnValue({
      total: 5,
      episodic: 3,
      semantic: 2,
      tombstoned: 0,
      avgStability: 0.8,
      avgRetention: 0.7,
    });
  });

  it('returns a MemoryStats shaped object', async () => {
    const { memory } = await createMemory(baseConfig);
    const stats = await memory.getStats();

    expect(stats).toHaveProperty('capturedAt');
    expect(stats).toHaveProperty('engramId');
    expect(stats).toHaveProperty('ltm');
    expect(stats).toHaveProperty('stm');
    expect(stats).toHaveProperty('amygdala');
    expect(stats).toHaveProperty('hippocampus');
    expect(stats).toHaveProperty('disk');
  });

  it('maps ltm engine stats to LtmStats fields', async () => {
    const { memory } = await createMemory(baseConfig);
    const stats = await memory.getStats();

    expect(stats.ltm.totalRecords).toBe(5);
    expect(stats.ltm.episodicCount).toBe(3);
    expect(stats.ltm.semanticCount).toBe(2);
    expect(stats.ltm.tombstonedCount).toBe(0);
    expect(stats.ltm.averageRetention).toBe(0.7);
  });

  it('tracks amygdala stats from events', async () => {
    const { memory } = await createMemory(baseConfig);

    memory.events.emit('amygdala:cycle:end', {
      cycleId: 'c1',
      durationMs: 1200,
      processed: 5,
      failures: 1,
      llmCalls: 4,
      estimatedTokens: 2000,
    });

    const stats = await memory.getStats();
    expect(stats.amygdala.lastCycleDurationMs).toBe(1200);
    expect(stats.amygdala.lastCycleInsightsProcessed).toBe(5);
    expect(stats.amygdala.lastCycleFailures).toBe(1);
    expect(stats.amygdala.sessionTotalLlmCalls).toBe(4);
    expect(stats.amygdala.sessionEstimatedTokens).toBe(2000);
  });

  it('tracks hippocampus stats from events', async () => {
    const { memory } = await createMemory(baseConfig);

    memory.events.emit('hippocampus:consolidation:end', {
      runId: 'r1',
      durationMs: 500,
      clustersConsolidated: 3,
      recordsPruned: 10,
      contextFilesDeleted: 2,
    });

    const stats = await memory.getStats();
    expect(stats.hippocampus.lastRunClustersConsolidated).toBe(3);
    expect(stats.hippocampus.lastRunRecordsPruned).toBe(10);
    expect(stats.hippocampus.lastConsolidationAt).toBeInstanceOf(Date);
  });
});

function makeBaseStatsSetup() {
  beforeEach(() => {
    vi.clearAllMocks();
    mockStmReadUnprocessed.mockReturnValue([]);
    mockLtmStats.mockReturnValue({
      total: 0,
      episodic: 0,
      semantic: 0,
      tombstoned: 0,
      avgStability: 0,
      avgRetention: 0,
    });
  });
}

describe('recallSession', () => {
  makeBaseStatsSetup();

  it('4.1 returns only records from specified engram', async () => {
    const fakeRecord = {
      record: { id: 1, data: 'engram memory', engramId: 'engram-abc' },
      effectiveScore: 0.9,
      rrfScore: 0.9,
      retrievalStrategies: ['semantic'],
      isSuperseded: false,
    };
    mockLtmQuery.mockReturnValueOnce({ isOk: () => true, value: [fakeRecord] } as never);
    const { memory } = await createMemory(baseConfig);
    const results = await memory.recallSession('what happened?', { engramId: 'engram-abc' });
    expect(mockLtmQuery).toHaveBeenCalledWith(
      'what happened?',
      expect.objectContaining({ engramId: 'engram-abc', strengthen: false }),
    );
    expect(results).toHaveLength(1);
    expect(results[0]).toBe(fakeRecord);
  });

  it('4.2 applies additional options alongside engramId filter', async () => {
    mockLtmQuery.mockReturnValueOnce({ isOk: () => true, value: [] });
    const { memory } = await createMemory(baseConfig);
    await memory.recallSession('query', { engramId: 'engram-abc', tier: 'episodic', limit: 5 });
    expect(mockLtmQuery).toHaveBeenCalledWith(
      'query',
      expect.objectContaining({
        engramId: 'engram-abc',
        tier: 'episodic',
        limit: 5,
        strengthen: false,
      }),
    );
  });

  it('4.3 returns empty array for unknown engram', async () => {
    mockLtmQuery.mockReturnValueOnce({ isOk: () => true, value: [] });
    const { memory } = await createMemory(baseConfig);
    const results = await memory.recallSession('query', { engramId: 'unknown-engram' });
    expect(results).toEqual([]);
  });
});

describe('recallFull', () => {
  makeBaseStatsSetup();

  it('4.4 returns correct episodeSummary for episodic record', async () => {
    const record = {
      id: 42,
      data: 'obs',
      tier: 'episodic',
      tombstoned: false,
      episodeSummary: 'summary text',
      engramId: 's',
    };
    mockLtmGetById.mockReturnValue(record);
    const { memory } = await createMemory(baseConfig);
    const result = await memory.recallFull(42);
    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      expect(result.value.record).toBe(record);
      expect(result.value.episodeSummary).toBe('summary text');
    }
  });

  it('4.5 returns undefined episodeSummary for semantic record without it', async () => {
    const record = {
      id: 7,
      data: 'semantic fact',
      tier: 'semantic',
      tombstoned: false,
      engramId: 's',
    };
    mockLtmGetById.mockReturnValue(record);
    const { memory } = await createMemory(baseConfig);
    const result = await memory.recallFull(7);
    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      expect(result.value.episodeSummary).toBeUndefined();
    }
  });

  it('4.6 returns RecordNotFoundError for unknown ID', async () => {
    mockLtmGetById.mockReset();
    const { memory } = await createMemory(baseConfig);
    const result = await memory.recallFull(999);
    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error).toBeInstanceOf(RecordNotFoundError);
    }
  });
});

describe('insertMemory', () => {
  makeBaseStatsSetup();

  it('returns the record id from ltm.insert', async () => {
    mockLtmInsert.mockReturnValueOnce(makeOkResult(42));
    const { memory } = await createMemory(baseConfig);
    const result = await memory.insertMemory('TypeScript is a superset of JavaScript');
    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      expect(result.value).toBe(42);
    }
  });

  it('passes options to ltm.insert', async () => {
    mockLtmInsert.mockReturnValueOnce(makeOkResult(7));
    const { memory } = await createMemory(baseConfig);
    await memory.insertMemory('some fact', { tier: 'semantic', importance: 0.8 });
    expect(mockLtmInsert).toHaveBeenCalledWith('some fact', { tier: 'semantic', importance: 0.8 });
  });

  it('returns Err when ltm.insert fails', async () => {
    mockLtmInsert.mockReturnValueOnce(makeErrorResult({ type: 'EMBEDDING_ERROR' }) as never);
    const { memory } = await createMemory(baseConfig);
    const result = await memory.insertMemory('bad');
    expect(result.isErr()).toBe(true);
  });
});

describe('importText', () => {
  makeBaseStatsSetup();

  it('calls LLM adapter and inserts each extracted memory', async () => {
    mockLlmAdapter.completeStructured.mockReturnValueOnce(
      okAsync(['fact one', 'fact two', 'fact three']),
    );
    mockLtmInsert.mockReturnValue(makeOkResult(1));
    const { memory } = await createMemory(baseConfig);
    const result = await memory.importText('some long text with multiple facts');
    expect(mockLlmAdapter.completeStructured).toHaveBeenCalledOnce();
    expect(mockLtmInsert).toHaveBeenCalledTimes(3);
    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      expect(result.value).toEqual({ inserted: 3 });
    }
  });

  it('returns Err when LLM adapter fails', async () => {
    mockLlmAdapter.completeStructured.mockReturnValueOnce(errAsync({ type: 'NO_CONTENT' }));
    const { memory } = await createMemory(baseConfig);
    const result = await memory.importText('some text');
    expect(result.isErr()).toBe(true);
  });
});

describe('getRecent', () => {
  makeBaseStatsSetup();

  it('returns records from ltm.getRecent with given limit', async () => {
    const fakeRecords = [
      { id: 3, data: 'newest', createdAt: new Date('2024-03-01'), tombstoned: false },
      { id: 2, data: 'older', createdAt: new Date('2024-02-01'), tombstoned: false },
      { id: 1, data: 'oldest', createdAt: new Date('2024-01-01'), tombstoned: false },
    ];
    mockLtmGetRecent.mockReturnValueOnce(fakeRecords);
    const { memory } = await createMemory(baseConfig);
    const result = memory.getRecent(3);
    expect(mockLtmGetRecent).toHaveBeenCalledWith(3);
    expect(result).toBe(fakeRecords);
  });

  it('returns empty array when no records exist', async () => {
    mockLtmGetRecent.mockReturnValueOnce([]);
    const { memory } = await createMemory(baseConfig);
    const result = memory.getRecent(10);
    expect(result).toEqual([]);
  });
});

describe('4.7 createMemory engramId wiring', () => {
  makeBaseStatsSetup();

  it('wires engramId to AmygdalaProcess when provided in config', async () => {
    const { AmygdalaProcess } = await import('@neurome/amygdala');
    await createMemory({ ...baseConfig, engramId: 'explicit-engram-id' });
    expect(AmygdalaProcess).toHaveBeenCalledWith(
      expect.objectContaining({ engramId: 'explicit-engram-id' }),
    );
  });
});

describe('agentProfile wiring', () => {
  makeBaseStatsSetup();

  it('passes agentProfile to AmygdalaProcess when provided', async () => {
    const { AmygdalaProcess } = await import('@neurome/amygdala');
    const agentProfile = { type: 'qa', purpose: 'Find UI bugs in the mobile app' };
    await createMemory({ ...baseConfig, agentProfile });
    expect(AmygdalaProcess).toHaveBeenCalledWith(expect.objectContaining({ agentProfile }));
  });

  it('does not include agentProfile in AmygdalaProcess when absent', async () => {
    const { AmygdalaProcess } = await import('@neurome/amygdala');
    await createMemory(baseConfig);
    const callArgument = (AmygdalaProcess as ReturnType<typeof vi.fn>).mock.calls[0]?.[0] as Record<
      string,
      unknown
    >;
    expect('agentProfile' in callArgument).toBe(false);
  });
});

describe('perirhinal orchestration', () => {
  makeBaseStatsSetup();

  it('4.1 amygdala:cycle:end triggers perirhinal run()', async () => {
    mockPerirhinalRun.mockReturnValue(
      okAsync({ recordsProcessed: 2, entitiesInserted: 1, entitiesReused: 1, errors: 0 }),
    );
    const { memory } = await createMemory(baseConfig);

    memory.events.emit('amygdala:cycle:end', {
      cycleId: 'c1',
      durationMs: 100,
      processed: 2,
      failures: 0,
      llmCalls: 2,
      estimatedTokens: 800,
    });

    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(mockPerirhinalRun).toHaveBeenCalledOnce();
  });

  it('4.2 perirhinal error emits event without throwing', async () => {
    mockPerirhinalRun.mockReturnValue(errAsync({ type: 'LOCK_FAILED' as const }));
    const { memory } = await createMemory(baseConfig);

    const handler = vi.fn();
    memory.events.on('perirhinal:extraction:end', handler);

    memory.events.emit('amygdala:cycle:end', {
      cycleId: 'c2',
      durationMs: 50,
      processed: 1,
      failures: 0,
      llmCalls: 1,
      estimatedTokens: 400,
    });

    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(handler).toHaveBeenCalledWith(expect.objectContaining({ errorType: 'LOCK_FAILED' }));
  });

  it('4.3 getStats() returns perirhinal field with last run values', async () => {
    mockPerirhinalRun.mockReturnValue(
      okAsync({ recordsProcessed: 3, entitiesInserted: 2, entitiesReused: 1, errors: 0 }),
    );
    const { memory } = await createMemory(baseConfig);

    memory.events.emit('amygdala:cycle:end', {
      cycleId: 'c3',
      durationMs: 200,
      processed: 3,
      failures: 0,
      llmCalls: 3,
      estimatedTokens: 1200,
    });

    await new Promise((resolve) => setTimeout(resolve, 0));

    const stats = await memory.getStats();
    expect(stats.perirhinal.recordsProcessed).toBe(3);
    expect(stats.perirhinal.entitiesInserted).toBe(2);
    expect(stats.perirhinal.entitiesReused).toBe(1);
    expect(stats.perirhinal.errors).toBe(0);
  });

  it('4.4 getStats() returns all-zero perirhinal stats before first run', async () => {
    const { memory } = await createMemory(baseConfig);
    const stats = await memory.getStats();
    expect(stats.perirhinal).toEqual({
      recordsProcessed: 0,
      entitiesInserted: 0,
      entitiesReused: 0,
      errors: 0,
    });
  });
});
