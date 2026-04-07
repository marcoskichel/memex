import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockCreateConnection } = vi.hoisted(() => ({
  mockCreateConnection: vi.fn(),
}));

vi.mock('node:net', () => ({
  createConnection: mockCreateConnection,
}));

vi.mock('@neurome/cortex-ipc', () => ({
  IPC_SOCKET_PATH: (engramId: string) => `/tmp/neurome-${engramId}.sock`,
}));

import { createAfferent } from '../index.js';

function makeSocket() {
  const listeners: Record<string, ((...arguments_: unknown[]) => void)[]> = {};
  return {
    write: vi.fn(),
    destroy: vi.fn(),
    on: vi.fn((event: string, function_: (...arguments_: unknown[]) => void) => {
      listeners[event] ??= [];
      listeners[event].push(function_);
    }),
    once: vi.fn((event: string, function_: (...arguments_: unknown[]) => void) => {
      listeners[event] ??= [];
      listeners[event].push(function_);
    }),
    emit(event: string, ...arguments_: unknown[]) {
      for (const function_ of listeners[event] ?? []) {
        function_(...arguments_);
      }
    },
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('createAfferent — buffering', () => {
  it('buffers events before connect and flushes in order on connect', () => {
    const socket = makeSocket();
    mockCreateConnection.mockReturnValue(socket);

    const afferent = createAfferent('engram-1');
    afferent.emit({ agent: 'explorer', text: 'first thought' });
    afferent.emit({ agent: 'explorer', text: 'second thought' });

    expect(socket.write).not.toHaveBeenCalled();

    socket.emit('connect');

    expect(socket.write).toHaveBeenCalledTimes(2);
    const frames = (socket.write.mock.calls as [string][]).map(([frame]) => {
      return JSON.parse(frame.trim()) as { payload: { summary: string } };
    });
    expect(frames[0]?.payload.summary).toBe('first thought');
    expect(frames[1]?.payload.summary).toBe('second thought');
  });

  it('writes directly once connected', () => {
    const socket = makeSocket();
    mockCreateConnection.mockReturnValue(socket);

    const afferent = createAfferent('engram-2');
    socket.emit('connect');

    afferent.emit({ agent: 'explorer', text: 'a thought' });

    expect(socket.write).toHaveBeenCalledTimes(1);
  });
});

describe('createAfferent — event translation', () => {
  it('emits logInsight with observation tag and correct summary', () => {
    const socket = makeSocket();
    mockCreateConnection.mockReturnValue(socket);
    const afferent = createAfferent('engram-3');
    socket.emit('connect');

    afferent.emit({ agent: 'explorer', text: 'I see the home screen' });

    const frame = JSON.parse((socket.write.mock.calls[0] as [string])[0].trim());
    expect(frame.type).toBe('logInsight');
    expect(frame.payload.summary).toBe('I see the home screen');
    expect(frame.payload.tags).toContain('observation');
    expect(frame.payload.tags).toContain('agent:explorer');
  });
});

describe('createAfferent — silent degradation', () => {
  it('does not throw when socket emits error', () => {
    const socket = makeSocket();
    mockCreateConnection.mockReturnValue(socket);
    const afferent = createAfferent('engram-4');

    expect(() => {
      socket.emit('error', new Error('ECONNREFUSED'));
    }).not.toThrow();
    expect(() => {
      afferent.emit({ agent: 'explorer', text: 'a thought' });
    }).not.toThrow();
  });
});

describe('createAfferent — runId', () => {
  it('all events from the same observer share the same runId tag', () => {
    const socket = makeSocket();
    mockCreateConnection.mockReturnValue(socket);
    const afferent = createAfferent('engram-5');
    socket.emit('connect');

    afferent.emit({ agent: 'explorer', text: 'thought one' });
    afferent.emit({ agent: 'explorer', text: 'thought two' });
    afferent.emit({ agent: 'explorer', text: 'thought three' });

    const runIds = (socket.write.mock.calls as [string][]).map(([frame]) => {
      const parsed = JSON.parse(frame.trim());
      return (parsed.payload.tags as string[]).find((tag) => tag.startsWith('run:'));
    });

    expect(new Set(runIds).size).toBe(1);
    expect(runIds[0]).toMatch(/^run:[\da-f-]{36}$/);
  });
});

describe('createAfferent — disconnect', () => {
  it('destroys socket and clears queue on disconnect', () => {
    const socket = makeSocket();
    mockCreateConnection.mockReturnValue(socket);
    const afferent = createAfferent('engram-6');

    afferent.emit({ agent: 'explorer', text: 'buffered thought' });
    afferent.disconnect();

    expect(socket.destroy).toHaveBeenCalledOnce();

    socket.emit('connect');
    expect(socket.write).not.toHaveBeenCalled();
  });
});
