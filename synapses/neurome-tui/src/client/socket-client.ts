import { randomUUID } from 'node:crypto';
import type { Socket } from 'node:net';
import { createConnection } from 'node:net';

import type { PushMessage } from '@neurome/cortex-ipc';
import { IPC_SOCKET_PATH } from '@neurome/cortex-ipc';

const REQUEST_TIMEOUT_MS = 5000;
const RECONNECT_DELAY_MS = 2000;
const MAX_RECONNECT_ATTEMPTS = 10;

type PushListener = (message: PushMessage) => void;
type ConnectionListener = (connected: boolean) => void;
type ErrorListener = (source: string, message: string) => void;

interface PendingRequest {
  resolve: (result: unknown) => void;
  reject: (error: Error) => void;
  timer: ReturnType<typeof setTimeout>;
}

export class MemexSocketClient {
  private socket: Socket | undefined;
  private buffer = '';
  private readonly pendingRequests = new Map<string, PendingRequest>();
  private pushListeners: PushListener[] = [];
  private connectionListeners: ConnectionListener[] = [];
  private errorListeners: ErrorListener[] = [];
  private reconnectAttempts = 0;
  private connected = false;
  private stopped = false;

  constructor(private readonly socketPath: string) {}

  static forSession(engramId: string): MemexSocketClient {
    return new MemexSocketClient(IPC_SOCKET_PATH(engramId));
  }

  get isConnected(): boolean {
    return this.connected;
  }

  get reconnectCount(): number {
    return this.reconnectAttempts;
  }

  get maxReconnectExceeded(): boolean {
    return this.reconnectAttempts >= MAX_RECONNECT_ATTEMPTS;
  }

  connect(): void {
    if (this.stopped) {
      return;
    }
    this.openSocket();
  }

  reset(): void {
    this.stopped = false;
    this.reconnectAttempts = 0;
    this.socket?.destroy();
    this.socket = undefined;
    for (const { timer, reject } of this.pendingRequests.values()) {
      clearTimeout(timer);
      reject(new Error('connection reset'));
    }
    this.pendingRequests.clear();
    this.openSocket();
  }

  disconnect(): void {
    this.stopped = true;
    this.socket?.destroy();
    for (const { timer, reject } of this.pendingRequests.values()) {
      clearTimeout(timer);
      reject(new Error('disconnected'));
    }
    this.pendingRequests.clear();
  }

  onPush(listener: PushListener): () => void {
    this.pushListeners.push(listener);
    return () => {
      this.pushListeners = this.pushListeners.filter((function_) => function_ !== listener);
    };
  }

  onConnectionChange(listener: ConnectionListener): () => void {
    this.connectionListeners.push(listener);
    return () => {
      this.connectionListeners = this.connectionListeners.filter(
        (function_) => function_ !== listener,
      );
    };
  }

  onError(listener: ErrorListener): () => void {
    this.errorListeners.push(listener);
    return () => {
      this.errorListeners = this.errorListeners.filter((function_) => function_ !== listener);
    };
  }

  recall(query: string, options?: unknown): Promise<unknown[]> {
    return this.request('recall', { query, options }) as Promise<unknown[]>;
  }

  getStats(): Promise<unknown> {
    return this.request('getStats', {});
  }

  insertMemory(data: string, options?: unknown): Promise<unknown> {
    return this.request('insertMemory', { data, options });
  }

  importText(text: string): Promise<unknown> {
    return this.request('importText', { text });
  }

  getRecent(limit: number): Promise<unknown[]> {
    return this.request('getRecent', { limit }) as Promise<unknown[]>;
  }

  consolidate(): Promise<void> {
    return this.request('consolidate', {}) as Promise<void>;
  }

  private request(type: string, payload: unknown): Promise<unknown> {
    const socket = this.socket;
    if (!this.connected || !socket) {
      return Promise.reject(new Error('not connected'));
    }

    const id = randomUUID();

    return new Promise<unknown>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pendingRequests.delete(id);
        reject(new Error(`request timed out: ${type}`));
      }, REQUEST_TIMEOUT_MS);

      this.pendingRequests.set(id, { resolve, reject, timer });
      socket.write(JSON.stringify({ id, type, payload }) + '\n');
    });
  }

  private openSocket(): void {
    const socket = createConnection(this.socketPath);
    this.socket = socket;

    socket.once('connect', () => {
      this.reconnectAttempts = 0;
      this.connected = true;
      this.notifyConnectionChange(true);
    });

    socket.on('data', (chunk: Buffer) => {
      this.buffer += chunk.toString();
      const lines = this.buffer.split('\n');
      this.buffer = lines.at(-1) ?? '';

      for (const line of lines.slice(0, -1)) {
        if (!line.trim()) {
          continue;
        }
        try {
          this.handleLine(JSON.parse(line) as unknown);
        } catch {
          for (const listener of this.errorListeners) {
            listener('socket', 'JSON parse error');
          }
        }
      }
    });

    socket.once('close', this.handleDisconnect);
    socket.once('error', this.handleDisconnect);
  }

  private handleLine(message: unknown): void {
    if (!message || typeof message !== 'object') {
      return;
    }

    const message_ = message as Record<string, unknown>;

    if (typeof message_.id === 'string') {
      const pending = this.pendingRequests.get(message_.id);
      if (pending) {
        clearTimeout(pending.timer);
        this.pendingRequests.delete(message_.id);
        if (message_.ok === true) {
          pending.resolve(message_.result);
        } else {
          const errorMessage =
            typeof message_.error === 'string' ? message_.error : 'request failed';
          pending.reject(new Error(errorMessage));
        }
      }
    } else if (message_.type === 'event') {
      const push = message as PushMessage;
      for (const listener of this.pushListeners) {
        listener(push);
      }
    }
  }

  private readonly handleDisconnect = (): void => {
    if (this.connected) {
      this.connected = false;
    }

    for (const { timer, reject } of this.pendingRequests.values()) {
      clearTimeout(timer);
      reject(new Error('connection lost'));
    }
    this.pendingRequests.clear();

    if (!this.stopped) {
      this.scheduleReconnect();
      this.notifyConnectionChange(false);
    }
  };

  private scheduleReconnect(): void {
    if (this.reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
      return;
    }

    this.reconnectAttempts++;
    setTimeout(() => {
      if (!this.stopped) {
        this.openSocket();
      }
    }, RECONNECT_DELAY_MS);
  }

  private notifyConnectionChange(connected: boolean): void {
    for (const listener of this.connectionListeners) {
      listener(connected);
    }
  }
}
