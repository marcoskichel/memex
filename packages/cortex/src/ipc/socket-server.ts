import { access, unlink } from 'node:fs/promises';
import type { Server, Socket } from 'node:net';
import { createConnection, createServer } from 'node:net';

import type { Memory } from '@memex/memory';

import { handleRequest } from './handlers.js';
import type { PushMessage, RequestMessage } from './protocol.js';

const MAX_BUFFER_BYTES = 1_048_576;
const VALID_REQUEST_TYPES = new Set<string>(['logInsight', 'getContext', 'recall', 'getStats']);

function isValidRequest(data: unknown): data is RequestMessage {
  if (!data || typeof data !== 'object') {
    return false;
  }
  const record = data as Record<string, unknown>;
  return typeof record.id === 'string' && VALID_REQUEST_TYPES.has(record.type as string);
}

export class SocketServer {
  private server: Server | undefined;
  private clients = new Set<Socket>();
  private readonly socketPath: string;

  constructor(socketPath: string) {
    this.socketPath = socketPath;
  }

  async start(memory: Memory): Promise<void> {
    await this.removeStaleSocket();

    this.server = createServer((client) => {
      this.clients.add(client);

      let buffer = '';
      client.on('data', (chunk) => {
        buffer += chunk.toString();

        if (buffer.length > MAX_BUFFER_BYTES) {
          buffer = '';
          client.destroy();
          return;
        }

        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed) {
            continue;
          }

          let parsed: unknown;
          try {
            parsed = JSON.parse(trimmed) as unknown;
          } catch {
            continue;
          }

          if (!isValidRequest(parsed)) {
            continue;
          }

          void handleRequest(parsed, memory).then((response) => {
            if (!client.destroyed) {
              client.write(JSON.stringify(response) + '\n');
            }
          });
        }
      });

      const removeClient = () => {
        this.clients.delete(client);
      };

      client.on('close', removeClient);
      client.on('error', removeClient);
    });

    const server = this.server;
    await new Promise<void>((resolve, reject) => {
      server.listen(this.socketPath, resolve);
      server.once('error', reject);
    });
  }

  async stop(): Promise<void> {
    for (const client of this.clients) {
      client.destroy();
    }
    this.clients.clear();

    await new Promise<void>((resolve) => {
      if (!this.server) {
        resolve();
        return;
      }
      this.server.close(() => {
        resolve();
      });
    });

    await this.removeSocketFile();
  }

  broadcast(message: PushMessage): void {
    const line = JSON.stringify(message) + '\n';
    for (const client of this.clients) {
      if (!client.destroyed) {
        client.write(line);
      }
    }
  }

  private async removeStaleSocket(): Promise<void> {
    try {
      await access(this.socketPath);
    } catch {
      return;
    }

    const isStale = await new Promise<boolean>((resolve) => {
      const probe = createConnection(this.socketPath);
      probe.once('connect', () => {
        probe.destroy();
        resolve(false);
      });
      probe.once('error', () => {
        resolve(true);
      });
    });

    if (isStale) {
      await unlink(this.socketPath);
    }
  }

  private async removeSocketFile(): Promise<void> {
    try {
      await unlink(this.socketPath);
    } catch {}
  }
}
