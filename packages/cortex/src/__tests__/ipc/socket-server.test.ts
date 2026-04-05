import { rm } from 'node:fs/promises';
import type { Socket } from 'node:net';
import { createConnection } from 'node:net';
import os from 'node:os';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { SocketServer } from '../../ipc/socket-server.js';

vi.mock('../../ipc/handlers.js', () => ({
  handleRequest: vi.fn((message: { id: string }) =>
    Promise.resolve({ id: message.id, ok: true, result: 'pong' }),
  ),
}));

const mockMemory = {} as never;

function makeSocketPath(): string {
  return path.join(
    os.tmpdir(),
    `memex-test-${Date.now().toString()}-${Math.random().toString(36).slice(2)}.sock`,
  );
}

function connectClient(sockPath: string): Promise<Socket> {
  return new Promise((resolve, reject) => {
    const client = createConnection(sockPath);
    client.once('connect', () => {
      resolve(client);
    });
    client.once('error', reject);
  });
}

function sendAndAwaitResponse(client: Socket, message: object): Promise<object> {
  return new Promise((resolve, reject) => {
    let buffer = '';
    const onData = (chunk: Buffer) => {
      buffer += chunk.toString();
      const lines = buffer.split('\n');
      buffer = lines.at(-1) ?? '';
      for (const line of lines.slice(0, -1)) {
        if (line.trim()) {
          client.removeListener('data', onData);
          resolve(JSON.parse(line) as object);
          return;
        }
      }
    };
    client.on('data', onData);
    client.once('error', reject);
    client.write(JSON.stringify(message) + '\n');
  });
}

function awaitNextMessage(client: Socket): Promise<object> {
  return new Promise((resolve) => {
    let buffer = '';
    const onData = (chunk: Buffer) => {
      buffer += chunk.toString();
      const lines = buffer.split('\n');
      buffer = lines.at(-1) ?? '';
      for (const line of lines.slice(0, -1)) {
        if (line.trim()) {
          client.removeListener('data', onData);
          resolve(JSON.parse(line) as object);
          return;
        }
      }
    };
    client.on('data', onData);
  });
}

describe('SocketServer', () => {
  let server: SocketServer;
  let sockPath: string;

  beforeEach(async () => {
    sockPath = makeSocketPath();
    server = new SocketServer(sockPath);
    await server.start(mockMemory);
  });

  afterEach(async () => {
    await server.stop();
    await rm(sockPath, { force: true });
  });

  it('accepts a client and returns a response', async () => {
    const client = await connectClient(sockPath);
    const response = await sendAndAwaitResponse(client, {
      id: 'req-1',
      type: 'recall',
      payload: { query: 'test' },
    });
    client.destroy();
    expect(response).toMatchObject({ id: 'req-1', ok: true, result: 'pong' });
  });

  it('broadcasts push message to all connected clients', async () => {
    const clientA = await connectClient(sockPath);
    const clientB = await connectClient(sockPath);

    await sendAndAwaitResponse(clientA, { id: 'ping-a', type: 'getStats', payload: {} });
    await sendAndAwaitResponse(clientB, { id: 'ping-b', type: 'getStats', payload: {} });

    const waitA = awaitNextMessage(clientA);
    const waitB = awaitNextMessage(clientB);

    server.broadcast({
      type: 'event',
      name: 'ltm:prune:executed',
      payload: { removedCount: 1, removedIds: [1] },
    });

    const [messageA, messageB] = await Promise.all([waitA, waitB]);

    clientA.destroy();
    clientB.destroy();

    expect(messageA).toMatchObject({ type: 'event', name: 'ltm:prune:executed' });
    expect(messageB).toMatchObject({ type: 'event', name: 'ltm:prune:executed' });
  });
});
