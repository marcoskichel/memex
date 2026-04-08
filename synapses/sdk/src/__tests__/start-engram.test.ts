import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockSpawn = vi.fn();
const mockGetStats = vi.fn(() => Promise.resolve({}));
const mockAxonClient = vi.fn(() => ({ getStats: mockGetStats }));

vi.mock('node:child_process', () => ({ spawn: mockSpawn }));
vi.mock('@neurome/axon', () => ({ AxonClient: mockAxonClient }));
vi.mock('better-sqlite3', () => ({ default: vi.fn() }));

type Listener = (...arguments_: unknown[]) => void;

function makeFakeProcess() {
  const listeners = new Map<string, Listener[]>();

  function on(event: string, listener: Listener) {
    listeners.set(event, [...(listeners.get(event) ?? []), listener]);
    return proc;
  }

  function once(event: string, listener: Listener) {
    const wrapper: Listener = (...arguments_) => {
      listener(...arguments_);
      off(event, wrapper);
    };
    return on(event, wrapper);
  }

  function off(event: string, listener: Listener) {
    listeners.set(
      event,
      (listeners.get(event) ?? []).filter((function_) => function_ !== listener),
    );
    return proc;
  }

  const stderrListeners = new Map<string, Listener[]>();
  const stderr = {
    on(event: string, listener: Listener) {
      stderrListeners.set(event, [...(stderrListeners.get(event) ?? []), listener]);
    },
    off(event: string, listener: Listener) {
      stderrListeners.set(
        event,
        (stderrListeners.get(event) ?? []).filter((function_) => function_ !== listener),
      );
    },
    emit(event: string, ...arguments_: unknown[]) {
      for (const function_ of stderrListeners.get(event) ?? []) {
        function_(...arguments_);
      }
    },
  };

  const proc = { on, once, off, stderr, pid: 1234 };

  setTimeout(() => {
    stderr.emit('data', Buffer.from('cortex ready\n'));
  }, 0);

  return proc;
}

const { startEngram } = await import('../start-engram.js');

describe('startEngram env var forwarding', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSpawn.mockReturnValue(makeFakeProcess());
    mockGetStats.mockResolvedValue({});
  });

  it('3.1 full agentProfile → both AGENT_PROFILE_TYPE and AGENT_PROFILE_PURPOSE in spawn env', async () => {
    await startEngram({
      engramId: 'test-engram',
      db: '/tmp/test.db',
      agentProfile: { type: 'qa', purpose: 'Find UI bugs' },
    });

    const spawnCall = mockSpawn.mock.calls[0] as [
      string,
      string[],
      { env: Record<string, string> },
    ];
    expect(spawnCall[2].env.AGENT_PROFILE_TYPE).toBe('qa');
    expect(spawnCall[2].env.AGENT_PROFILE_PURPOSE).toBe('Find UI bugs');
  });

  it('3.2 no agentProfile → neither env var present in spawn env', async () => {
    await startEngram({ engramId: 'test-engram', db: '/tmp/test.db' });

    const spawnCall = mockSpawn.mock.calls[0] as [
      string,
      string[],
      { env: Record<string, string> },
    ];
    expect('AGENT_PROFILE_TYPE' in spawnCall[2].env).toBe(false);
    expect('AGENT_PROFILE_PURPOSE' in spawnCall[2].env).toBe(false);
  });

  it('3.3 agentProfile with only purpose → only AGENT_PROFILE_PURPOSE in spawn env', async () => {
    await startEngram({
      engramId: 'test-engram',
      db: '/tmp/test.db',
      agentProfile: { purpose: 'Measure performance' },
    });

    const spawnCall = mockSpawn.mock.calls[0] as [
      string,
      string[],
      { env: Record<string, string> },
    ];
    expect('AGENT_PROFILE_TYPE' in spawnCall[2].env).toBe(false);
    expect(spawnCall[2].env.AGENT_PROFILE_PURPOSE).toBe('Measure performance');
  });
});
