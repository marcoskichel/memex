import { describe, expect, it, vi } from 'vitest';

import { Engram } from '../engram.js';

function makeEngram() {
  return new Engram({
    engramId: 'test-id',
    db: '/tmp/test.db',
    axon: {
      recall: vi.fn(),
      logInsight: vi.fn(),
      insertMemory: vi.fn(),
      getRecent: vi.fn(),
      getStats: vi.fn(),
      consolidate: vi.fn(),
      fork: vi.fn(),
      disconnect: vi.fn(),
    },
    cortex: { kill: vi.fn(), once: vi.fn() } as never,
  });
}

describe('Engram.asMcpServer()', () => {
  it('defaults to read-only when no options provided', () => {
    const config = makeEngram().asMcpServer();
    expect(config.env.NEUROME_ACCESS_MODE).toBe('read-only');
  });

  it('sets read-only when accessMode is explicitly read-only', () => {
    const config = makeEngram().asMcpServer({ accessMode: 'read-only' });
    expect(config.env.NEUROME_ACCESS_MODE).toBe('read-only');
  });

  it('sets full when accessMode is full', () => {
    const config = makeEngram().asMcpServer({ accessMode: 'full' });
    expect(config.env.NEUROME_ACCESS_MODE).toBe('full');
  });

  it('always includes NEUROME_ENGRAM_ID and MEMORY_DB_PATH', () => {
    const config = makeEngram().asMcpServer();
    expect(config.env.NEUROME_ENGRAM_ID).toBe('test-id');
    expect(config.env.MEMORY_DB_PATH).toBe('/tmp/test.db');
  });
});
