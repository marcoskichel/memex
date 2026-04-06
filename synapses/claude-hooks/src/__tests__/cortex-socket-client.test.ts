import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockCreateConnection } = vi.hoisted(() => ({
  mockCreateConnection: vi.fn(),
}));

vi.mock('node:net', () => ({
  createConnection: mockCreateConnection,
}));

vi.mock('@neurome/cortex', () => ({
  IPC_SOCKET_PATH: (sessionId: string) => `/tmp/neurome-${sessionId}.sock`,
}));

import { getContext, sendLogInsight } from '../shell/clients/cortex-socket-client.js';

function makeSocket() {
  const listeners: Record<string, ((...arguments_: unknown[]) => void)[]> = {};
  const socket = {
    write: vi.fn(),
    destroy: vi.fn(),
    once: vi.fn((event: string, function_: (...arguments_: unknown[]) => void) => {
      listeners[event] ??= [];
      listeners[event].push(function_);
    }),
    on: vi.fn((event: string, function_: (...arguments_: unknown[]) => void) => {
      listeners[event] ??= [];
      listeners[event].push(function_);
    }),
    emit(event: string, ...arguments_: unknown[]) {
      for (const function_ of listeners[event] ?? []) {
        function_(...arguments_);
      }
    },
  };
  return socket;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('sendLogInsight', () => {
  it('writes a logInsight request to the socket', async () => {
    const socket = makeSocket();
    mockCreateConnection.mockReturnValue(socket);

    const promise = sendLogInsight(
      { summary: 'tool call', contextFile: '', tags: ['Read'] },
      'sess-abc',
    );

    socket.emit('connect');
    await promise;

    expect(mockCreateConnection).toHaveBeenCalledWith('/tmp/neurome-sess-abc.sock');
    expect(socket.write).toHaveBeenCalledOnce();
    const [firstCall] = socket.write.mock.calls as [[string]];
    const written = JSON.parse(firstCall[0].trim());
    expect(written).toMatchObject({ type: 'logInsight' });
  });

  it('exits gracefully when socket errors', async () => {
    const socket = makeSocket();
    mockCreateConnection.mockReturnValue(socket);

    const promise = sendLogInsight({ summary: 'tool call', contextFile: '', tags: [] }, 'sess-err');

    socket.emit('error', new Error('ECONNREFUSED'));
    await expect(promise).resolves.toBeUndefined();
  });

  it('resolves after timeout even with no connection', async () => {
    const socket = makeSocket();
    mockCreateConnection.mockReturnValue(socket);

    const start = Date.now();
    const promise = sendLogInsight({ summary: 'x', contextFile: '', tags: [] }, 'sess-slow');

    await promise;
    expect(Date.now() - start).toBeLessThan(500);
  });
});

describe('getContext', () => {
  it('writes a getContext request and returns the result', async () => {
    const socket = makeSocket();
    mockCreateConnection.mockReturnValue(socket);

    const promise = getContext(
      { sessionId: 'sess-abc', toolName: 'Read', toolInput: { path: '/foo' } },
      'sess-abc',
    );

    socket.emit('connect');

    const response = JSON.stringify({ id: '1', ok: true, result: 'relevant context here' }) + '\n';
    const dataListeners = (socket.on.mock.calls as [string, (...arguments_: unknown[]) => void][])
      .filter(([event]) => event === 'data')
      .map(([, function_]) => function_);

    for (const function_ of dataListeners) {
      function_(Buffer.from(response));
    }

    const result = await promise;
    expect(result).toBe('relevant context here');
  });

  it('returns empty string when socket errors', async () => {
    const socket = makeSocket();
    mockCreateConnection.mockReturnValue(socket);

    const promise = getContext(
      { sessionId: 'sess-err', toolName: 'Read', toolInput: {} },
      'sess-err',
    );

    socket.emit('error', new Error('ECONNREFUSED'));
    const result = await promise;
    expect(result).toBe('');
  });
});
