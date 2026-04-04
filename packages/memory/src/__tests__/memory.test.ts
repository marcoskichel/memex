import { beforeEach, describe, expect, it, vi } from 'vitest';

import { MemoryEventEmitter } from '../memory-events.js';
import { createMemory } from '../memory.js';

const mockStmAppend = vi.fn();
const mockStmReadUnprocessed = vi.fn(() => []);
const mockStmMarkProcessed = vi.fn();

const mockLtmQuery = vi.fn(() => ({ isOk: () => true, value: [] }));
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

vi.mock('@neurokit/ltm', () => ({
  SqliteAdapter: vi.fn(() => ({})),
  TransformersJsAdapter: vi.fn(() => ({})),
  LtmEngine: vi.fn(() => ({
    query: mockLtmQuery,
    stats: mockLtmStats,
  })),
}));

vi.mock('@neurokit/stm', () => ({
  InsightLog: vi.fn(() => ({
    append: mockStmAppend,
    readUnprocessed: mockStmReadUnprocessed,
    markProcessed: mockStmMarkProcessed,
  })),
}));

vi.mock('@neurokit/amygdala', () => ({
  AmygdalaProcess: vi.fn(() => ({
    run: mockAmygdalaRun,
    start: mockAmygdalaStart,
    stop: mockAmygdalaStop,
  })),
}));

vi.mock('@neurokit/hippocampus', () => ({
  HippocampusProcess: vi.fn(() => ({
    start: mockHippocampusStart,
    stop: mockHippocampusStop,
  })),
}));

vi.mock('node:fs/promises', () => ({
  mkdir: vi.fn(() => Promise.resolve()),
  readdir: vi.fn(() => Promise.resolve([])),
  stat: vi.fn(() => Promise.resolve({ isFile: () => true, size: 0, mtimeMs: Date.now() })),
  unlink: vi.fn(() => Promise.resolve()),
}));

const mockLlmAdapter = { complete: vi.fn(), completeStructured: vi.fn() };

const baseConfig = {
  storagePath: '/tmp/test.db',
  llmAdapter: mockLlmAdapter,
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

  it('memory has a sessionId', async () => {
    const { memory } = await createMemory(baseConfig);
    expect(typeof memory.sessionId).toBe('string');
    expect(memory.sessionId).toBeTruthy();
  });

  it('memory.events is a MemoryEventEmitter', async () => {
    const { memory } = await createMemory(baseConfig);
    expect(memory.events).toBeInstanceOf(MemoryEventEmitter);
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
    expect(mockLtmQuery).toHaveBeenCalledWith('what did I learn about X?', { strengthen: false });
  });

  it('passes through additional options including strengthen override', async () => {
    const { memory } = await createMemory(baseConfig);
    memory.recall('some query', { strengthen: true, limit: 5 });
    expect(mockLtmQuery).toHaveBeenCalledWith('some query', { strengthen: true, limit: 5 });
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

    expect(report).toHaveProperty('sessionId');
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
    expect(stats).toHaveProperty('sessionId');
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
