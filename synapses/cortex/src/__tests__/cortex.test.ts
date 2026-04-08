import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mockShutdown = vi.fn(() => Promise.resolve({}));
const mockMemory = { shutdown: mockShutdown };
const mockCreateMemory = vi.fn(() => Promise.resolve({ memory: mockMemory, startupStats: {} }));

vi.mock('@neurome/memory', () => ({
  createMemory: mockCreateMemory,
}));

vi.mock('@neurome/llm', () => ({
  AnthropicAdapter: vi.fn(() => ({})),
}));

vi.mock('@neurome/stm', () => ({
  SqliteInsightLog: vi.fn(() => ({})),
}));

const {
  readConfig,
  ConfigError,
  shutdownOnce,
  resetShutdownState,
  setActiveMemory,
  MEMORY_EVENT_NAMES,
} = await import('../bin/cortex-core.js');

describe('MEMORY_EVENT_NAMES', () => {
  it('includes perirhinal:extraction:end for broadcast to clients', () => {
    expect(MEMORY_EVENT_NAMES).toContain('perirhinal:extraction:end');
  });
});

describe('readConfig', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    delete process.env.MEMORY_DB_PATH;
    delete process.env.ANTHROPIC_API_KEY;
    delete process.env.OPENAI_API_KEY;
    delete process.env.NEUROME_ENGRAM_ID;
    delete process.env.AGENT_PROFILE_TYPE;
    delete process.env.AGENT_PROFILE_PURPOSE;
  });

  afterEach(() => {
    Object.assign(process.env, originalEnv);
  });

  it('throws ConfigError when MEMORY_DB_PATH is missing', () => {
    process.env.ANTHROPIC_API_KEY = 'test-key';
    process.env.OPENAI_API_KEY = 'sk-openai';
    expect(() => readConfig()).toThrow(ConfigError);
    expect(() => readConfig()).toThrow('MEMORY_DB_PATH is required');
  });

  it('throws ConfigError when ANTHROPIC_API_KEY is missing', () => {
    process.env.MEMORY_DB_PATH = '/tmp/test.db';
    process.env.OPENAI_API_KEY = 'sk-openai';
    expect(() => readConfig()).toThrow(ConfigError);
    expect(() => readConfig()).toThrow('ANTHROPIC_API_KEY is required');
  });

  it('throws ConfigError when OPENAI_API_KEY is missing', () => {
    process.env.MEMORY_DB_PATH = '/tmp/test.db';
    process.env.ANTHROPIC_API_KEY = 'sk-test';
    expect(() => readConfig()).toThrow(ConfigError);
    expect(() => readConfig()).toThrow('OPENAI_API_KEY is required');
  });

  it('returns correct config when all env vars are set', () => {
    process.env.MEMORY_DB_PATH = '/tmp/test.db';
    process.env.ANTHROPIC_API_KEY = 'sk-test';
    process.env.OPENAI_API_KEY = 'sk-openai';
    process.env.NEUROME_ENGRAM_ID = 'engram-123';
    const config = readConfig();
    expect(config.dbPath).toBe('/tmp/test.db');
    expect(config.apiKey).toBe('sk-test');
    expect(config.openaiApiKey).toBe('sk-openai');
    expect(config.engramId).toBe('engram-123');
  });

  it('omits engramId when NEUROME_ENGRAM_ID is not set', () => {
    process.env.MEMORY_DB_PATH = '/tmp/test.db';
    process.env.ANTHROPIC_API_KEY = 'sk-test';
    process.env.OPENAI_API_KEY = 'sk-openai';
    const config = readConfig();
    expect('engramId' in config).toBe(false);
  });

  it('3.1 both AGENT_PROFILE_TYPE and AGENT_PROFILE_PURPOSE set → agentProfile populated', () => {
    process.env.MEMORY_DB_PATH = '/tmp/test.db';
    process.env.ANTHROPIC_API_KEY = 'sk-test';
    process.env.OPENAI_API_KEY = 'sk-openai';
    process.env.AGENT_PROFILE_TYPE = 'qa';
    process.env.AGENT_PROFILE_PURPOSE = 'Find UI bugs';
    const config = readConfig();
    expect(config.agentProfile).toEqual({ type: 'qa', purpose: 'Find UI bugs' });
  });

  it('3.2 only AGENT_PROFILE_PURPOSE set → agentProfile has purpose only', () => {
    process.env.MEMORY_DB_PATH = '/tmp/test.db';
    process.env.ANTHROPIC_API_KEY = 'sk-test';
    process.env.OPENAI_API_KEY = 'sk-openai';
    process.env.AGENT_PROFILE_PURPOSE = 'Measure performance';
    const config = readConfig();
    expect(config.agentProfile).toEqual({ purpose: 'Measure performance' });
    expect(config.agentProfile).not.toHaveProperty('type');
  });

  it('3.3 neither AGENT_PROFILE_TYPE nor AGENT_PROFILE_PURPOSE set → agentProfile is undefined', () => {
    process.env.MEMORY_DB_PATH = '/tmp/test.db';
    process.env.ANTHROPIC_API_KEY = 'sk-test';
    process.env.OPENAI_API_KEY = 'sk-openai';
    const config = readConfig();
    expect('agentProfile' in config).toBe(false);
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
