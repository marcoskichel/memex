import { beforeEach, describe, expect, it, vi } from 'vitest';

import { handleRequest, serializeRecallResults } from '../../ipc/handlers.js';
import type { RequestMessage } from '../../ipc/protocol.js';

function makeRecord(overrides: Record<string, unknown> = {}) {
  return {
    id: 1,
    data: 'test memory',
    tier: 'episodic' as const,
    createdAt: new Date('2026-04-09T00:00:00Z'),
    metadata: {},
    ...overrides,
  };
}

function makeResult(overrides: Record<string, unknown> = {}) {
  return {
    record: makeRecord(),
    effectiveScore: 0.6,
    rrfScore: 0.04,
    isSuperseded: false,
    supersedingIds: [] as number[],
    retrievalStrategies: ['semantic'] as ('semantic' | 'temporal' | 'associative' | 'companion')[],
    ...overrides,
  };
}

const mockRecall = vi.fn();
const mockGetStats = vi.fn();
const mockLogInsight = vi.fn();
const mockInsertMemory = vi.fn();
const mockImportText = vi.fn();
const mockGetRecent = vi.fn();

const mockMemory = {
  engramId: 'test-engram',
  logInsight: mockLogInsight,
  recall: mockRecall,
  getStats: mockGetStats,
  insertMemory: mockInsertMemory,
  importText: mockImportText,
  getRecent: mockGetRecent,
} as never;

function okResult<T>(value: T) {
  return { isOk: () => true, isErr: () => false, value };
}

function errorResult(type: string) {
  return { isOk: () => false, isErr: () => true, error: { type } };
}

function makeItem(id: number) {
  return {
    record: { id, data: `record-${id.toString()}`, metadata: {}, tier: 'episodic' },
    effectiveScore: 0.5,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockGetStats.mockResolvedValue({
    disk: { contextDirectory: '/tmp/ctx' },
  });
  mockRecall.mockResolvedValue(okResult([]));
});

describe('handleRequest — logInsight', () => {
  it('calls memory.logInsight and returns ok result', async () => {
    const message: RequestMessage = {
      id: '1',
      type: 'logInsight',
      payload: { summary: 'test insight', contextFile: '/tmp/ctx/file.md', tags: ['test'] },
    };
    const response = await handleRequest(message, mockMemory);
    expect(mockLogInsight).toHaveBeenCalledWith(message.payload);
    expect(response).toMatchObject({ id: '1', ok: true });
  });
});

describe('handleRequest — recall', () => {
  it('delegates to memory.recall and returns serialized results', async () => {
    const fakeItems = [makeResult({ record: makeRecord({ data: 'foo' }), effectiveScore: 0.9 })];
    mockRecall.mockResolvedValueOnce(okResult(fakeItems));
    const message: RequestMessage = {
      id: '2',
      type: 'recall',
      payload: { query: 'auth flow', options: { limit: 5 } },
    };
    const response = await handleRequest(message, mockMemory);
    expect(mockRecall).toHaveBeenCalledWith('auth flow', { limit: 5 });
    expect(response).toMatchObject({ id: '2', ok: true });
    const result = (response as { result: unknown[] }).result;
    expect(result[0]).toMatchObject({ memory: 'foo', tier: 'episodic', relevance: 'high' });
  });

  it('returns error response when recall fails', async () => {
    mockRecall.mockResolvedValueOnce(errorResult('EMBEDDING_MODEL_MISMATCH'));
    const message: RequestMessage = {
      id: '2b',
      type: 'recall',
      payload: { query: 'auth flow' },
    };
    const response = await handleRequest(message, mockMemory);
    expect(response).toMatchObject({ id: '2b', ok: false });
  });
});

describe('handleRequest — getStats', () => {
  it('delegates to memory.getStats and returns stats', async () => {
    const fakeStats = { capturedAt: new Date(), engramId: 'test-engram' };
    mockGetStats.mockResolvedValueOnce(fakeStats);
    const message: RequestMessage = {
      id: '3',
      type: 'getStats',
      payload: {},
    };
    const response = await handleRequest(message, mockMemory);
    expect(mockGetStats).toHaveBeenCalledOnce();
    expect(response).toMatchObject({ id: '3', ok: true, result: fakeStats });
  });
});

describe('handleRequest — unknown type', () => {
  it('returns ok: false with error message', async () => {
    const message = { id: '4', type: 'badType', payload: {} } as unknown as RequestMessage;
    const response = await handleRequest(message, mockMemory);
    expect(response).toMatchObject({ id: '4', ok: false });
    expect((response as { error: string }).error).toContain('unknown request type');
  });
});

describe('handleRequest — insertMemory', () => {
  it('delegates to memory.insertMemory and returns id', async () => {
    mockInsertMemory.mockResolvedValueOnce(okResult(99));
    const message: RequestMessage = {
      id: '10',
      type: 'insertMemory',
      payload: { data: 'TypeScript is great', options: { tier: 'semantic', importance: 0.8 } },
    };
    const response = await handleRequest(message, mockMemory);
    expect(mockInsertMemory).toHaveBeenCalledWith('TypeScript is great', {
      tier: 'semantic',
      importance: 0.8,
    });
    expect(response).toMatchObject({ id: '10', ok: true, result: 99 });
  });
});

describe('handleRequest — importText', () => {
  it('delegates to memory.importText and returns inserted count', async () => {
    mockImportText.mockResolvedValueOnce(okResult({ inserted: 5 }));
    const message: RequestMessage = {
      id: '11',
      type: 'importText',
      payload: { text: 'some long text with many facts' },
    };
    const response = await handleRequest(message, mockMemory);
    expect(mockImportText).toHaveBeenCalledWith('some long text with many facts');
    expect(response).toMatchObject({ id: '11', ok: true, result: { inserted: 5 } });
  });
});

describe('handleRequest — getRecent', () => {
  it('delegates to memory.getRecent and returns records', async () => {
    const fakeRecords = [{ id: 1, data: 'recent memory' }];
    mockGetRecent.mockReturnValueOnce(fakeRecords);
    const message: RequestMessage = {
      id: '12',
      type: 'getRecent',
      payload: { limit: 20 },
    };
    const response = await handleRequest(message, mockMemory);
    expect(mockGetRecent).toHaveBeenCalledWith(20);
    expect(response).toMatchObject({ id: '12', ok: true, result: fakeRecords });
  });
});

describe('handleRequest — getContext', () => {
  it('issues three parallel recall queries and returns formatted string', async () => {
    const message: RequestMessage = {
      id: '5',
      type: 'getContext',
      payload: { engramId: 'test-engram', toolName: 'Read', toolInput: { path: '/foo' } },
    };
    const response = await handleRequest(message, mockMemory);
    expect(mockRecall).toHaveBeenCalledTimes(3);
    expect(mockRecall).toHaveBeenCalledWith(JSON.stringify({ path: '/foo' }), { limit: 5 });
    expect(mockRecall).toHaveBeenCalledWith('current user identity, agent goals, session context', {
      limit: 2,
    });
    expect(mockRecall).toHaveBeenCalledWith(
      'project being built, architectural decisions, codebase overview',
      { limit: 2 },
    );
    expect(mockGetStats).toHaveBeenCalledOnce();
    expect(response).toMatchObject({ id: '5', ok: true });
    expect(typeof (response as { result: unknown }).result).toBe('string');
  });

  it('deduplicates records with the same id across queries', async () => {
    const sharedRecord = { id: 42, data: 'shared', metadata: {}, tier: 'episodic' };
    const sharedItem = { record: sharedRecord, effectiveScore: 0.8 };
    mockRecall
      .mockResolvedValueOnce(okResult([sharedItem]))
      .mockResolvedValueOnce(okResult([sharedItem]))
      .mockResolvedValueOnce(okResult([]));
    const message: RequestMessage = {
      id: '6',
      type: 'getContext',
      payload: { engramId: 'test-engram', toolName: 'Read', toolInput: {} },
    };
    const response = await handleRequest(message, mockMemory);
    const result = (response as { result: string }).result;
    expect(result.match(/shared/g)?.length).toBe(1);
  });

  it('sorts merged results by effectiveScore descending', async () => {
    const low = {
      record: { id: 1, data: 'low', metadata: {}, tier: 'episodic' },
      effectiveScore: 0.3,
    };
    const high = {
      record: { id: 2, data: 'high', metadata: {}, tier: 'semantic' },
      effectiveScore: 0.9,
    };
    mockRecall
      .mockResolvedValueOnce(okResult([low]))
      .mockResolvedValueOnce(okResult([high]))
      .mockResolvedValueOnce(okResult([]));
    const message: RequestMessage = {
      id: '7',
      type: 'getContext',
      payload: { engramId: 'test-engram', toolName: 'Read', toolInput: {} },
    };
    const response = await handleRequest(message, mockMemory);
    const result = (response as { result: string }).result;
    expect(result.indexOf('high')).toBeLessThan(result.indexOf('low'));
  });

  it('caps result count at RECALL_LIMIT_FOR_CONTEXT (5)', async () => {
    mockRecall
      .mockResolvedValueOnce(okResult([makeItem(1), makeItem(2), makeItem(3)]))
      .mockResolvedValueOnce(okResult([makeItem(4), makeItem(5)]))
      .mockResolvedValueOnce(okResult([makeItem(6), makeItem(7)]));
    const message: RequestMessage = {
      id: '8',
      type: 'getContext',
      payload: { engramId: 'test-engram', toolName: 'Read', toolInput: {} },
    };
    const response = await handleRequest(message, mockMemory);
    const result = (response as { result: string }).result;
    const recordMatches = result.match(/record-\d+/g) ?? [];
    expect(recordMatches.length).toBeLessThanOrEqual(5);
  });

  it('returns partial results when a secondary query fails', async () => {
    const item = {
      record: { id: 1, data: 'primary hit', metadata: {}, tier: 'episodic' },
      effectiveScore: 0.7,
    };
    mockRecall
      .mockResolvedValueOnce(okResult([item]))
      .mockResolvedValueOnce(errorResult('EMBED_API_UNAVAILABLE'))
      .mockResolvedValueOnce(okResult([]));
    const message: RequestMessage = {
      id: '9',
      type: 'getContext',
      payload: { engramId: 'test-engram', toolName: 'Read', toolInput: {} },
    };
    const response = await handleRequest(message, mockMemory);
    expect(response).toMatchObject({ id: '9', ok: true });
    expect((response as { result: string }).result).toContain('primary hit');
  });

  it('returns secondary results when primary query fails', async () => {
    const item = {
      record: { id: 2, data: 'identity hit', metadata: {}, tier: 'semantic' },
      effectiveScore: 0.6,
    };
    mockRecall
      .mockResolvedValueOnce(errorResult('EMBED_API_UNAVAILABLE'))
      .mockResolvedValueOnce(okResult([item]))
      .mockResolvedValueOnce(okResult([]));
    const message: RequestMessage = {
      id: '10',
      type: 'getContext',
      payload: { engramId: 'test-engram', toolName: 'Read', toolInput: {} },
    };
    const response = await handleRequest(message, mockMemory);
    expect(response).toMatchObject({ id: '10', ok: true });
    expect((response as { result: string }).result).toContain('identity hit');
  });
});

describe('serializeRecallResults', () => {
  it('normal record serialized as MemoryEntry with correct fields', () => {
    const result = makeResult({
      record: makeRecord({
        data: 'some memory',
        metadata: { tags: ['navigation'], entities: [{ name: 'settings', type: 'screen' }] },
      }),
      effectiveScore: 0.6,
    });
    const output = serializeRecallResults([result]);
    expect(output).toHaveLength(1);
    expect(output[0]).toMatchObject({
      memory: 'some memory',
      tier: 'episodic',
      relevance: 'medium',
      tags: ['navigation'],
      entities: [{ name: 'settings', type: 'screen' }],
      recordedAt: '2026-04-09',
    });
    expect(output[0]).not.toHaveProperty('rrfScore');
    expect(output[0]).not.toHaveProperty('embeddingMeta');
    expect(output[0]).not.toHaveProperty('accessCount');
    expect(output[0]).not.toHaveProperty('stability');
    expect(output[0]).not.toHaveProperty('episodeSummary');
  });

  it('hash-format tags are stripped, semantic tags retained', () => {
    const result = makeResult({
      record: makeRecord({
        metadata: {
          tags: [
            'navigation',
            'e746227e08f44f1e42d2226b8025373afa403d38283e578be42aa0d90acca0f2',
            'Settings',
          ],
        },
      }),
    });
    const output = serializeRecallResults([result]);
    expect((output[0] as { tags: string[] }).tags).toEqual(['navigation', 'Settings']);
  });

  it('effectiveScore >= 0.7 maps to high relevance', () => {
    const output = serializeRecallResults([makeResult({ effectiveScore: 0.7 })]);
    expect((output[0] as { relevance: string }).relevance).toBe('high');
  });

  it('effectiveScore >= 0.5 and < 0.7 maps to medium relevance', () => {
    const output = serializeRecallResults([makeResult({ effectiveScore: 0.5 })]);
    expect((output[0] as { relevance: string }).relevance).toBe('medium');
  });

  it('effectiveScore < 0.5 maps to low relevance', () => {
    const output = serializeRecallResults([makeResult({ effectiveScore: 0.43 })]);
    expect((output[0] as { relevance: string }).relevance).toBe('low');
  });

  it('superseded + companion grouped as MemoryChange', () => {
    const supersededRecord = makeRecord({ id: 1, data: 'old path' });
    const companionRecord = makeRecord({ id: 2, data: 'new path' });
    const superseded = makeResult({
      record: supersededRecord,
      effectiveScore: 0.85,
      isSuperseded: true,
      supersedingIds: [2],
    });
    const companion = makeResult({
      record: companionRecord,
      effectiveScore: 0.52,
      retrievalStrategies: ['companion'] as (
        | 'semantic'
        | 'temporal'
        | 'associative'
        | 'companion'
      )[],
    });
    const output = serializeRecallResults([superseded, companion]);
    expect(output).toHaveLength(1);
    expect(output[0]).toMatchObject({
      type: 'changed',
      current: { memory: 'new path', relevance: 'medium' },
      supersedes: { memory: 'old path', relevance: 'high' },
    });
  });

  it('superseded with no companion in results emitted with superseded: true', () => {
    const result = makeResult({
      record: makeRecord({ data: 'orphaned stale memory' }),
      isSuperseded: true,
      supersedingIds: [99],
    });
    const output = serializeRecallResults([result]);
    expect(output).toHaveLength(1);
    expect(output[0]).toMatchObject({ memory: 'orphaned stale memory', superseded: true });
  });

  it('multiple companions — first matching companion used', () => {
    const supersededRecord = makeRecord({ id: 1, data: 'old fact' });
    const companion10 = makeRecord({ id: 10, data: 'first replacement' });
    const companion11 = makeRecord({ id: 11, data: 'second replacement' });
    const superseded = makeResult({
      record: supersededRecord,
      isSuperseded: true,
      supersedingIds: [10, 11],
    });
    const c10 = makeResult({
      record: companion10,
      retrievalStrategies: ['companion'] as (
        | 'semantic'
        | 'temporal'
        | 'associative'
        | 'companion'
      )[],
    });
    const c11 = makeResult({
      record: companion11,
      retrievalStrategies: ['companion'] as (
        | 'semantic'
        | 'temporal'
        | 'associative'
        | 'companion'
      )[],
    });
    const output = serializeRecallResults([superseded, c10, c11]);
    expect(output).toHaveLength(2);
    const change = output.find((entry) => 'type' in entry) as
      | { current: { memory: string } }
      | undefined;
    expect(change?.current.memory).toBe('first replacement');
  });
});
