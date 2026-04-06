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

    const afferent = createAfferent('sess-1');
    afferent.emit({ type: 'STAGE_START', agent: 'explorer' });
    afferent.emit({ type: 'THOUGHT', agent: 'explorer', text: 'hi' });

    expect(socket.write).not.toHaveBeenCalled();

    socket.emit('connect');

    expect(socket.write).toHaveBeenCalledTimes(2);
    const frames = (socket.write.mock.calls as [string][]).map(([frame]) => {
      return JSON.parse(frame.trim()) as { payload: { summary: string } };
    });
    expect(frames[0]?.payload.summary).toContain('started');
    expect(frames[1]?.payload.summary).toContain('hi');
  });

  it('writes directly once connected', () => {
    const socket = makeSocket();
    mockCreateConnection.mockReturnValue(socket);

    const afferent = createAfferent('sess-2');
    socket.emit('connect');

    afferent.emit({ type: 'STAGE_END', agent: 'explorer', durationMs: 1000 });

    expect(socket.write).toHaveBeenCalledTimes(1);
  });
});

describe('createAfferent — event translation', () => {
  it('translates STAGE_START with lifecycle tag', () => {
    const socket = makeSocket();
    mockCreateConnection.mockReturnValue(socket);
    const afferent = createAfferent('sess-3');
    socket.emit('connect');

    afferent.emit({ type: 'STAGE_START', agent: 'explorer' });

    const frame = JSON.parse((socket.write.mock.calls[0] as [string])[0].trim());
    expect(frame.type).toBe('logInsight');
    expect(frame.payload.summary).toContain('explorer');
    expect(frame.payload.tags).toContain('lifecycle');
  });

  it('translates THOUGHT with observation tag', () => {
    const socket = makeSocket();
    mockCreateConnection.mockReturnValue(socket);
    const afferent = createAfferent('sess-4');
    socket.emit('connect');

    afferent.emit({ type: 'THOUGHT', agent: 'explorer', text: 'I see the home screen' });

    const frame = JSON.parse((socket.write.mock.calls[0] as [string])[0].trim());
    expect(frame.payload.summary).toContain('I see the home screen');
    expect(frame.payload.tags).toContain('observation');
  });

  it('handles unknown event type without throwing', () => {
    const socket = makeSocket();
    mockCreateConnection.mockReturnValue(socket);
    const afferent = createAfferent('sess-7');
    socket.emit('connect');

    expect(() => {
      afferent.emit({ type: 'UNKNOWN_TYPE', agent: 'explorer' });
    }).not.toThrow();

    const frame = JSON.parse((socket.write.mock.calls[0] as [string])[0].trim()) as {
      payload: { summary: string };
    };
    expect(frame.payload.summary).toContain('UNKNOWN_TYPE');
  });
});

describe('createAfferent — silent degradation', () => {
  it('does not throw when socket emits error', () => {
    const socket = makeSocket();
    mockCreateConnection.mockReturnValue(socket);
    const afferent = createAfferent('sess-8');

    expect(() => {
      socket.emit('error', new Error('ECONNREFUSED'));
    }).not.toThrow();
    expect(() => {
      afferent.emit({ type: 'STAGE_START', agent: 'explorer' });
    }).not.toThrow();
  });
});

describe('createAfferent — runId', () => {
  it('all events from the same observer share the same runId tag', () => {
    const socket = makeSocket();
    mockCreateConnection.mockReturnValue(socket);
    const afferent = createAfferent('sess-9');
    socket.emit('connect');

    afferent.emit({ type: 'STAGE_START', agent: 'explorer' });
    afferent.emit({ type: 'THOUGHT', agent: 'explorer', text: 'hi' });
    afferent.emit({ type: 'STAGE_END', agent: 'explorer', durationMs: 500 });

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
    const afferent = createAfferent('sess-10');

    afferent.emit({ type: 'STAGE_START', agent: 'explorer' });
    afferent.disconnect();

    expect(socket.destroy).toHaveBeenCalledOnce();

    socket.emit('connect');
    expect(socket.write).not.toHaveBeenCalled();
  });
});
