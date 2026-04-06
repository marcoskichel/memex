import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockCreateConnection } = vi.hoisted(() => ({
  mockCreateConnection: vi.fn(),
}));

vi.mock('node:net', () => ({
  createConnection: mockCreateConnection,
}));

vi.mock('@memex/cortex', () => ({
  IPC_SOCKET_PATH: (sessionId: string) => `/tmp/memex-${sessionId}.sock`,
}));

import { MemexSocketClient } from '../client/socket-client.js';

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

describe('MemexSocketClient.forSession', () => {
  it('creates client with correct socket path', () => {
    const client = MemexSocketClient.forSession('my-session');
    expect(client).toBeInstanceOf(MemexSocketClient);
  });
});

describe('connect / onConnectionChange', () => {
  it('notifies connection listeners on connect', () => {
    const socket = makeSocket();
    mockCreateConnection.mockReturnValue(socket);

    const client = MemexSocketClient.forSession('sess-1');
    const onConn = vi.fn();
    client.onConnectionChange(onConn);
    client.connect();

    expect(mockCreateConnection).toHaveBeenCalledWith('/tmp/memex-sess-1.sock');

    socket.emit('connect');
    expect(onConn).toHaveBeenCalledWith(true);
    expect(client.isConnected).toBe(true);
  });

  it('notifies connection listeners on disconnect', () => {
    const socket = makeSocket();
    mockCreateConnection.mockReturnValue(socket);

    const client = MemexSocketClient.forSession('sess-2');
    const onConn = vi.fn();
    client.onConnectionChange(onConn);
    client.connect();

    socket.emit('connect');
    socket.emit('close');

    expect(onConn).toHaveBeenLastCalledWith(false);
    expect(client.isConnected).toBe(false);
  });

  it('notifies connection listeners on initial connection failure before ever connecting', () => {
    vi.useFakeTimers();

    const socket = makeSocket();
    mockCreateConnection.mockReturnValue(socket);

    const client = MemexSocketClient.forSession('sess-2b');
    const onConn = vi.fn();
    client.onConnectionChange(onConn);
    client.connect();

    socket.emit('error', new Error('ECONNREFUSED'));

    expect(onConn).toHaveBeenCalledWith(false);
    expect(client.reconnectCount).toBe(1);

    vi.useRealTimers();
  });
});

describe('recall / getStats — request timeout', () => {
  it('rejects recall with timeout error after 5s', async () => {
    vi.useFakeTimers();

    const socket = makeSocket();
    mockCreateConnection.mockReturnValue(socket);

    const client = MemexSocketClient.forSession('sess-3');
    client.connect();
    socket.emit('connect');

    const recallPromise = client.recall('auth system');

    vi.advanceTimersByTime(5001);

    await expect(recallPromise).rejects.toThrow('request timed out');

    vi.useRealTimers();
  });
});

describe('push events', () => {
  it('emits push messages to listeners', () => {
    const socket = makeSocket();
    mockCreateConnection.mockReturnValue(socket);

    const client = MemexSocketClient.forSession('sess-4');
    const onPush = vi.fn();
    client.onPush(onPush);
    client.connect();
    socket.emit('connect');

    const push = {
      type: 'event',
      name: 'ltm:prune:executed',
      payload: { removedCount: 1, removedIds: [1] },
    };
    const dataListeners = (socket.on.mock.calls as [string, (...arguments_: unknown[]) => void][])
      .filter(([event]) => event === 'data')
      .map(([, function_]) => function_);

    for (const function_ of dataListeners) {
      function_(Buffer.from(JSON.stringify(push) + '\n'));
    }

    expect(onPush).toHaveBeenCalledWith(push);
  });
});

describe('insertMemory / importText / getRecent', () => {
  it('insertMemory sends correct IPC message and resolves', async () => {
    const socket = makeSocket();
    mockCreateConnection.mockReturnValue(socket);

    const client = MemexSocketClient.forSession('sess-im');
    client.connect();
    socket.emit('connect');

    const dataListeners = (socket.on.mock.calls as [string, (...arguments_: unknown[]) => void][])
      .filter(([event]) => event === 'data')
      .map(([, function_]) => function_);

    const promise = client.insertMemory('TypeScript is a superset', { tier: 'semantic' });

    const lastWrite = (socket.write.mock.calls.at(-1) as [string])[0];
    const { id, type, payload } = JSON.parse(lastWrite) as {
      id: string;
      type: string;
      payload: unknown;
    };
    expect(type).toBe('insertMemory');
    expect(payload).toMatchObject({
      data: 'TypeScript is a superset',
      options: { tier: 'semantic' },
    });

    for (const function_ of dataListeners) {
      function_(Buffer.from(JSON.stringify({ id, ok: true, result: 42 }) + '\n'));
    }

    await expect(promise).resolves.toBe(42);
  });

  it('importText sends correct IPC message and resolves', async () => {
    const socket = makeSocket();
    mockCreateConnection.mockReturnValue(socket);

    const client = MemexSocketClient.forSession('sess-it');
    client.connect();
    socket.emit('connect');

    const dataListeners = (socket.on.mock.calls as [string, (...arguments_: unknown[]) => void][])
      .filter(([event]) => event === 'data')
      .map(([, function_]) => function_);

    const promise = client.importText('some long text');

    const lastWrite = (socket.write.mock.calls.at(-1) as [string])[0];
    const { id, type, payload } = JSON.parse(lastWrite) as {
      id: string;
      type: string;
      payload: unknown;
    };
    expect(type).toBe('importText');
    expect(payload).toMatchObject({ text: 'some long text' });

    for (const function_ of dataListeners) {
      function_(Buffer.from(JSON.stringify({ id, ok: true, result: { inserted: 5 } }) + '\n'));
    }

    await expect(promise).resolves.toMatchObject({ inserted: 5 });
  });

  it('getRecent sends correct IPC message and resolves with array', async () => {
    const socket = makeSocket();
    mockCreateConnection.mockReturnValue(socket);

    const client = MemexSocketClient.forSession('sess-gr');
    client.connect();
    socket.emit('connect');

    const dataListeners = (socket.on.mock.calls as [string, (...arguments_: unknown[]) => void][])
      .filter(([event]) => event === 'data')
      .map(([, function_]) => function_);

    const fakeRecords = [{ id: 1, data: 'recent' }];
    const promise = client.getRecent(20);

    const lastWrite = (socket.write.mock.calls.at(-1) as [string])[0];
    const { id, type, payload } = JSON.parse(lastWrite) as {
      id: string;
      type: string;
      payload: unknown;
    };
    expect(type).toBe('getRecent');
    expect(payload).toMatchObject({ limit: 20 });

    for (const function_ of dataListeners) {
      function_(Buffer.from(JSON.stringify({ id, ok: true, result: fakeRecords }) + '\n'));
    }

    await expect(promise).resolves.toEqual(fakeRecords);
  });
});

describe('reset', () => {
  it('clears stopped flag and re-opens socket', () => {
    const socket1 = makeSocket();
    const socket2 = makeSocket();
    mockCreateConnection.mockReturnValueOnce(socket1).mockReturnValueOnce(socket2);

    const client = MemexSocketClient.forSession('sess-reset');
    client.connect();
    socket1.emit('connect');

    client.reset();
    socket2.emit('connect');

    expect(mockCreateConnection).toHaveBeenCalledTimes(2);
    expect(client.isConnected).toBe(true);
    expect(client.reconnectCount).toBe(0);
  });
});

describe('onError — JSON parse error', () => {
  it('calls error listeners when a line fails to parse', () => {
    const socket = makeSocket();
    mockCreateConnection.mockReturnValue(socket);

    const client = MemexSocketClient.forSession('sess-err');
    const onError = vi.fn();
    client.onError(onError);
    client.connect();
    socket.emit('connect');
    socket.emit('data', Buffer.from('not valid json\n'));

    expect(onError).toHaveBeenCalledWith('socket', 'JSON parse error');
  });
});

describe('reconnect logic', () => {
  it('schedules reconnect after disconnect', () => {
    vi.useFakeTimers();

    const socket1 = makeSocket();
    const socket2 = makeSocket();
    mockCreateConnection.mockReturnValueOnce(socket1).mockReturnValueOnce(socket2);

    const client = MemexSocketClient.forSession('sess-5');
    client.connect();
    socket1.emit('connect');
    socket1.emit('close');

    expect(client.reconnectCount).toBe(1);
    vi.advanceTimersByTime(2001);
    expect(mockCreateConnection).toHaveBeenCalledTimes(2);

    vi.useRealTimers();
  });

  it('stops reconnecting after max attempts', () => {
    vi.useFakeTimers();

    const sockets = Array.from({ length: 12 }, () => makeSocket());
    let callIndex = 0;
    mockCreateConnection.mockImplementation(() => sockets[callIndex++]);

    const client = MemexSocketClient.forSession('sess-6');
    client.connect();

    for (let index = 0; index < 10; index++) {
      sockets[index]?.emit('close');
      vi.advanceTimersByTime(2001);
    }

    expect(client.maxReconnectExceeded).toBe(true);
    expect(mockCreateConnection).toHaveBeenCalledTimes(11);

    vi.useRealTimers();
  });
});
