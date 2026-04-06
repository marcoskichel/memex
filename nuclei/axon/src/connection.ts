import { createConnection, type Socket } from 'node:net';

import type { ResponseMessage } from '@neurome/cortex-ipc';

const RECONNECT_DELAY_MS = 100;
const MAX_RECONNECT_ATTEMPTS = 3;

export interface PendingRequest {
  resolve: (value: unknown) => void;
  reject: (reason: Error) => void;
  timer: ReturnType<typeof setTimeout>;
}

export type ConnectionState = 'disconnected' | 'connecting' | 'connected' | 'reconnecting';

function isResponseMessage(value: unknown): value is ResponseMessage {
  if (value === null || typeof value !== 'object') {
    return false;
  }
  const record = value as { id?: unknown; ok?: unknown };
  return typeof record.id === 'string' && typeof record.ok === 'boolean';
}

export interface ConnectionDeps {
  inflight: Map<string, PendingRequest>;
  pending: (() => void)[];
}

export class Connection {
  socket: Socket | undefined;
  state: ConnectionState = 'disconnected';
  buffer = '';
  reconnectAttempts = 0;

  private readonly inflight: Map<string, PendingRequest>;
  private readonly pending: (() => void)[];

  constructor(
    private readonly socketPath: string,
    deps: ConnectionDeps,
  ) {
    this.inflight = deps.inflight;
    this.pending = deps.pending;
  }

  async open(): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      const socket = createConnection(this.socketPath);

      socket.once('connect', () => {
        this.socket = socket;
        this.state = 'connected';
        this.reconnectAttempts = 0;
        this.buffer = '';
        this.flushPending(true);
        resolve();
      });

      socket.on('data', (chunk: Buffer) => {
        this.handleData(chunk.toString());
      });

      socket.once('error', (socketError: Error) => {
        if (this.state === 'connecting') {
          this.state = 'disconnected';
          reject(socketError);
          return;
        }
        void this.handleDisconnect();
      });

      socket.once('close', () => {
        if (this.state === 'connected') {
          void this.handleDisconnect();
        }
      });
    });
  }

  close(): void {
    this.state = 'disconnected';
    if (this.socket) {
      this.socket.destroy();
      this.socket = undefined;
    }
    this.buffer = '';
    this.pending.length = 0;
  }

  private async handleDisconnect(): Promise<void> {
    if (this.state === 'reconnecting' || this.state === 'disconnected') {
      return;
    }

    this.state = 'reconnecting';
    this.socket = undefined;
    this.buffer = '';

    while (this.reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
      this.reconnectAttempts++;
      await delayMs(RECONNECT_DELAY_MS * this.reconnectAttempts);
      try {
        await this.open();
        return;
      } catch {
        continue;
      }
    }

    this.state = 'disconnected';
    const error = new Error('Connection lost and max reconnect attempts exceeded');
    for (const [id, pending] of this.inflight) {
      clearTimeout(pending.timer);
      pending.reject(error);
      this.inflight.delete(id);
    }
    this.flushPending(false);
  }

  private flushPending(_success: boolean): void {
    for (const callback of this.pending.splice(0)) {
      callback();
    }
  }

  private handleData(chunk: string): void {
    this.buffer += chunk;
    const lines = this.buffer.split('\n');
    this.buffer = lines.at(-1) ?? '';

    for (const line of lines.slice(0, -1)) {
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

      if (!isResponseMessage(parsed)) {
        continue;
      }

      const pending = this.inflight.get(parsed.id);
      if (!pending) {
        continue;
      }

      clearTimeout(pending.timer);
      this.inflight.delete(parsed.id);

      if (parsed.ok) {
        pending.resolve(parsed.result);
      } else {
        pending.reject(new Error(parsed.error));
      }
    }
  }
}

function delayMs(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
