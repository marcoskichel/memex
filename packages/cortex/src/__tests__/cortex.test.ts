import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mockShutdown = vi.fn(() => Promise.resolve({}));
const mockMemory = { shutdown: mockShutdown };
const mockCreateMemory = vi.fn(() => Promise.resolve({ memory: mockMemory, startupStats: {} }));

vi.mock('@neurokit/memory', () => ({
  createMemory: mockCreateMemory,
}));

vi.mock('@neurokit/llm', () => ({
  AnthropicAdapter: vi.fn(() => ({})),
}));

vi.mock('@neurokit/stm', () => ({
  SqliteInsightLog: vi.fn(() => ({})),
}));

const { readConfig, ConfigError, shutdownOnce, resetShutdownState, setActiveMemory } =
  await import('../bin/cortex-core.js');

describe('readConfig', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    delete process.env.MEMORY_DB_PATH;
    delete process.env.ANTHROPIC_API_KEY;
    delete process.env.MEMORY_SESSION_ID;
  });

  afterEach(() => {
    Object.assign(process.env, originalEnv);
  });

  it('throws ConfigError when MEMORY_DB_PATH is missing', () => {
    process.env.ANTHROPIC_API_KEY = 'test-key';
    expect(() => readConfig()).toThrow(ConfigError);
    expect(() => readConfig()).toThrow('MEMORY_DB_PATH is required');
  });

  it('throws ConfigError when ANTHROPIC_API_KEY is missing', () => {
    process.env.MEMORY_DB_PATH = '/tmp/test.db';
    expect(() => readConfig()).toThrow(ConfigError);
    expect(() => readConfig()).toThrow('ANTHROPIC_API_KEY is required');
  });

  it('returns correct config when all env vars are set', () => {
    process.env.MEMORY_DB_PATH = '/tmp/test.db';
    process.env.ANTHROPIC_API_KEY = 'sk-test';
    process.env.MEMORY_SESSION_ID = 'session-123';
    const config = readConfig();
    expect(config.dbPath).toBe('/tmp/test.db');
    expect(config.apiKey).toBe('sk-test');
    expect(config.sessionId).toBe('session-123');
  });

  it('omits sessionId when MEMORY_SESSION_ID is not set', () => {
    process.env.MEMORY_DB_PATH = '/tmp/test.db';
    process.env.ANTHROPIC_API_KEY = 'sk-test';
    const config = readConfig();
    expect('sessionId' in config).toBe(false);
  });
});

describe('shutdownOnce', () => {
  let exitCodes: number[] = [];

  beforeEach(() => {
    exitCodes = [];
    resetShutdownState();
    vi.clearAllMocks();
    vi.spyOn(process, 'exit').mockImplementation((code) => {
      if (typeof code === 'number') {
        exitCodes.push(code);
      }
      return undefined as never;
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('calls memory.shutdown and then process.exit(0)', async () => {
    setActiveMemory(mockMemory as never);
    shutdownOnce();
    await vi.waitFor(() => {
      expect(mockShutdown).toHaveBeenCalledOnce();
    });
    await vi.waitFor(() => {
      expect(exitCodes).toContain(0);
    });
  });

  it('is idempotent — only shuts down once even when called multiple times', async () => {
    setActiveMemory(mockMemory as never);
    shutdownOnce();
    shutdownOnce();
    shutdownOnce();
    await vi.waitFor(() => {
      expect(mockShutdown).toHaveBeenCalledTimes(1);
    });
  });
});
