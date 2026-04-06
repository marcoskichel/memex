import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { mockCreateConnection } = vi.hoisted(() => ({
  mockCreateConnection: vi.fn(),
}));

vi.mock('node:net', () => ({
  createConnection: mockCreateConnection,
}));

vi.mock('@neurome/cortex', () => ({
  IPC_SOCKET_PATH: (sessionId: string) => {
    const valid = /^[\da-z][\w-]{0,127}$/i;
    if (!valid.test(sessionId)) {
      throw new Error(`Invalid sessionId: ${sessionId}`);
    }
    return `/tmp/neurome-${sessionId}.sock`;
  },
}));

import { AxonClient } from '../axon-client.js';

function makeSocket() {
  const listeners: Record<string, ((...arguments_: unknown[]) => void)[]> = {};

  const socket = {
    write: vi.fn((_data: unknown, callback?: (error?: Error) => void) => {
      callback?.();
      return true;
    }),
    destroy: vi.fn(),
    on: vi.fn((event: string, function_: (...arguments_: unknown[]) => void) => {
      listeners[event] ??= [];
      listeners[event].push(function_);
      return socket;
    }),
    once: vi.fn((event: string, function_: (...arguments_: unknown[]) => void) => {
      listeners[event] ??= [];
      listeners[event].push(function_);
      return socket;
    }),
    emit(event: string, ...arguments_: unknown[]) {
      for (const function_ of listeners[event] ?? []) {
        function_(...arguments_);
      }
    },
  };

  return socket;
}

type MockSocket = ReturnType<typeof makeSocket>;

interface RespondOptions {
  socket: MockSocket;
  id: string;
  result: unknown;
}

interface RespondErrorOptions {
  socket: MockSocket;
  id: string;
  error: string;
}

function respond({ socket, id, result }: RespondOptions) {
  const frame = JSON.stringify({ id, ok: true, result }) + '\n';
  socket.emit('data', Buffer.from(frame));
}

function respondError({ socket, id, error }: RespondErrorOptions) {
  const frame = JSON.stringify({ id, ok: false, error }) + '\n';
  socket.emit('data', Buffer.from(frame));
}

async function waitForWrite(socket: MockSocket, count = 1): Promise<void> {
  await vi.waitFor(() => {
    expect(socket.write).toHaveBeenCalledTimes(count);
  });
}

function getWrittenRequest(socket: MockSocket, index = 0): { id: string } {
  const call = socket.write.mock.calls[index] as [string] | undefined;
  return JSON.parse((call ?? ['{}'])[0].trim()) as { id: string };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('AxonClient — construction', () => {
  it('throws synchronously for an invalid session ID', () => {
    expect(() => new AxonClient('../../etc/passwd')).toThrow('Invalid sessionId');
  });

  it('does not throw for a valid session ID', () => {
    expect(() => new AxonClient('valid-session-1')).not.toThrow();
  });
});

describe('AxonClient — concurrent requests', () => {
  it('resolves concurrent requests with their own correct responses', async () => {
    const socket = makeSocket();
    mockCreateConnection.mockReturnValue(socket);

    const client = new AxonClient('session-1');

    const promise1 = client.recall('query one');
    const promise2 = client.recall('query two');

    socket.emit('connect');

    await waitForWrite(socket, 2);

    const requestA = getWrittenRequest(socket, 0);
    const requestB = getWrittenRequest(socket, 1);

    respond({ socket, id: requestA.id, result: [{ record: { id: 10 }, effectiveScore: 0.5 }] });
    respond({ socket, id: requestB.id, result: [{ record: { id: 20 }, effectiveScore: 0.9 }] });

    const [result1, result2] = await Promise.all([promise1, promise2]);

    const ids = new Set([result1.at(0)?.record.id, result2.at(0)?.record.id]);
    expect(ids).toContain(10);
    expect(ids).toContain(20);
  });
});

describe('AxonClient — timeout', () => {
  it('rejects with timeout error when no response arrives', async () => {
    vi.useFakeTimers();

    const socket = makeSocket();
    mockCreateConnection.mockReturnValue(socket);

    const client = new AxonClient('session-2');
    const promise = client.recall('slow query', { timeoutMs: 100 });

    socket.emit('connect');
    await Promise.resolve();
    await Promise.resolve();

    vi.advanceTimersByTime(200);

    await expect(promise).rejects.toThrow('timed out');
    vi.useRealTimers();
  });

  it('allows subsequent calls after a timeout', async () => {
    vi.useFakeTimers();

    const socket = makeSocket();
    mockCreateConnection.mockReturnValue(socket);

    const client = new AxonClient('session-3');
    const slowPromise = client.recall('slow', { timeoutMs: 50 });

    socket.emit('connect');
    await Promise.resolve();
    await Promise.resolve();

    vi.advanceTimersByTime(100);

    await expect(slowPromise).rejects.toThrow('timed out');

    vi.useRealTimers();

    const fastPromise = client.recall('fast');
    await waitForWrite(socket, 2);

    const request = getWrittenRequest(socket, 1);
    respond({ socket, id: request.id, result: [] });
    await expect(fastPromise).resolves.toEqual([]);
  });
});

describe('AxonClient — disconnect', () => {
  it('rejects in-flight requests when disconnect is called', async () => {
    const socket = makeSocket();
    mockCreateConnection.mockReturnValue(socket);

    const client = new AxonClient('session-4');
    const inflightPromise = client.recall('in-flight query');

    socket.emit('connect');

    client.disconnect();

    await expect(inflightPromise).rejects.toThrow('disconnected');
  });

  it('destroys the socket on disconnect', async () => {
    const socket = makeSocket();
    mockCreateConnection.mockReturnValue(socket);

    const client = new AxonClient('session-5');
    const warmupPromise = client.recall('warmup');
    socket.emit('connect');

    await waitForWrite(socket, 1);

    const request = getWrittenRequest(socket, 0);
    respond({ socket, id: request.id, result: [] });
    await warmupPromise;

    client.disconnect();

    expect(socket.destroy).toHaveBeenCalledOnce();
  });
});

describe('AxonClient — error response', () => {
  it('rejects with the error message from cortex', async () => {
    const socket = makeSocket();
    mockCreateConnection.mockReturnValue(socket);

    const client = new AxonClient('session-6');
    const statsPromise = client.getStats();

    socket.emit('connect');
    await waitForWrite(socket, 1);

    const request = getWrittenRequest(socket, 0);
    respondError({ socket, id: request.id, error: 'memory not ready' });

    await expect(statsPromise).rejects.toThrow('memory not ready');
  });
});

afterEach(() => {
  vi.useRealTimers();
});
