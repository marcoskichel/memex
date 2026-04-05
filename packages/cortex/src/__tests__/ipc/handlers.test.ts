import { beforeEach, describe, expect, it, vi } from 'vitest';

import { handleRequest } from '../../ipc/handlers.js';
import type { RequestMessage } from '../../ipc/protocol.js';

const mockRecall = vi.fn();
const mockGetStats = vi.fn();
const mockLogInsight = vi.fn();

const mockMemory = {
  sessionId: 'test-session',
  logInsight: mockLogInsight,
  recall: mockRecall,
  getStats: mockGetStats,
} as never;

function okResult<T>(value: T) {
  return { isOk: () => true, isErr: () => false, value };
}

function errorResult(type: string) {
  return { isOk: () => false, isErr: () => true, error: { type } };
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
  it('delegates to memory.recall and returns results', async () => {
    const fakeItems = [
      { record: { data: 'foo', metadata: {}, tier: 'episodic' }, effectiveScore: 0.9 },
    ];
    mockRecall.mockResolvedValueOnce(okResult(fakeItems));
    const message: RequestMessage = {
      id: '2',
      type: 'recall',
      payload: { query: 'auth flow', options: { limit: 5 } },
    };
    const response = await handleRequest(message, mockMemory);
    expect(mockRecall).toHaveBeenCalledWith('auth flow', { limit: 5 });
    expect(response).toMatchObject({ id: '2', ok: true, result: fakeItems });
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
    const fakeStats = { capturedAt: new Date(), sessionId: 'test-session' };
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

describe('handleRequest — getContext', () => {
  it('calls recall and getStats and returns formatted string', async () => {
    const message: RequestMessage = {
      id: '5',
      type: 'getContext',
      payload: { sessionId: 'test-session', toolName: 'Read', toolInput: { path: '/foo' } },
    };
    const response = await handleRequest(message, mockMemory);
    expect(mockRecall).toHaveBeenCalledWith(JSON.stringify({ path: '/foo' }), { limit: 5 });
    expect(mockGetStats).toHaveBeenCalledOnce();
    expect(response).toMatchObject({ id: '5', ok: true });
    expect(typeof (response as { result: unknown }).result).toBe('string');
  });
});
