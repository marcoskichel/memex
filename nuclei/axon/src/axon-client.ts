import { randomUUID } from 'node:crypto';

import type {
  ConsolidatePayload,
  GetContextPayload,
  GetRecentPayload,
  GetStatsPayload,
  ImportTextPayload,
  InsertMemoryPayload,
  LogInsightPayload,
  LtmRecord,
  RecallOptions,
} from '@neurome/cortex-ipc';
import { IPC_SOCKET_PATH } from '@neurome/cortex-ipc';

import { Connection, type PendingRequest } from './connection.js';

const DEFAULT_READ_TIMEOUT_MS = 200;

export type MemoryStats = Record<string, unknown>;

export interface RecallResult {
  record: {
    id: number;
    tier: string;
    data: string;
    metadata: unknown;
  };
  effectiveScore: number;
}

export interface RecallParams {
  options?: RecallOptions;
  timeoutMs?: number;
}

export interface InsertMemoryOptions {
  options?: InsertMemoryPayload['options'];
  timeoutMs?: number;
}

export class AxonClient {
  private readonly connection: Connection;
  private readonly inflight = new Map<string, PendingRequest>();
  private readonly pending: (() => void)[] = [];

  constructor(sessionId: string) {
    const socketPath = IPC_SOCKET_PATH(sessionId);
    this.connection = new Connection(socketPath, {
      inflight: this.inflight,
      pending: this.pending,
    });
  }

  async recall(query: string, recallOptions?: RecallParams): Promise<RecallResult[]> {
    const payload: { query: string; options?: RecallOptions } = { query };
    if (recallOptions?.options !== undefined) {
      payload.options = recallOptions.options;
    }
    return this.sendRequest<RecallResult[]>({
      type: 'recall',
      payload,
      timeoutMs: recallOptions?.timeoutMs ?? DEFAULT_READ_TIMEOUT_MS,
    });
  }

  async getContext(
    payload: GetContextPayload,
    timeoutMs = DEFAULT_READ_TIMEOUT_MS,
  ): Promise<string> {
    return this.sendRequest<string>({ type: 'getContext', payload, timeoutMs });
  }

  async getRecent(limit: number, timeoutMs = DEFAULT_READ_TIMEOUT_MS): Promise<LtmRecord[]> {
    const payload: GetRecentPayload = { limit };
    return this.sendRequest<LtmRecord[]>({ type: 'getRecent', payload, timeoutMs });
  }

  async getStats(timeoutMs = DEFAULT_READ_TIMEOUT_MS): Promise<MemoryStats> {
    const payload: GetStatsPayload = {};
    return this.sendRequest<MemoryStats>({ type: 'getStats', payload, timeoutMs });
  }

  logInsight(payload: LogInsightPayload): void {
    const id = randomUUID();
    const frame = JSON.stringify({ id, type: 'logInsight', payload }) + '\n';
    if (this.connection.state === 'connected' && this.connection.socket) {
      this.connection.socket.write(frame);
    } else {
      void this.ensureConnected().then(() => {
        this.connection.socket?.write(frame);
      });
    }
  }

  async insertMemory(data: string, insertOptions?: InsertMemoryOptions): Promise<number> {
    const payload: InsertMemoryPayload = { data };
    if (insertOptions?.options !== undefined) {
      payload.options = insertOptions.options;
    }
    return this.sendRequest<number>({
      type: 'insertMemory',
      payload,
      timeoutMs: insertOptions?.timeoutMs ?? DEFAULT_READ_TIMEOUT_MS,
    });
  }

  async importText(
    text: string,
    timeoutMs = DEFAULT_READ_TIMEOUT_MS,
  ): Promise<{ inserted: number }> {
    const payload: ImportTextPayload = { text };
    return this.sendRequest<{ inserted: number }>({ type: 'importText', payload, timeoutMs });
  }

  async consolidate(timeoutMs = DEFAULT_READ_TIMEOUT_MS): Promise<void> {
    const payload: ConsolidatePayload = {};
    await this.sendRequest<undefined>({ type: 'consolidate', payload, timeoutMs });
  }

  disconnect(): void {
    const error = new Error('Client disconnected');
    for (const [id, pending] of this.inflight) {
      clearTimeout(pending.timer);
      pending.reject(error);
      this.inflight.delete(id);
    }
    this.connection.close();
  }

  private sendRequest<T>({
    type,
    payload,
    timeoutMs,
  }: {
    type: string;
    payload: unknown;
    timeoutMs: number;
  }): Promise<T> {
    const id = randomUUID();

    return new Promise<T>((resolve, reject) => {
      const timer = setTimeout(() => {
        if (this.inflight.has(id)) {
          this.inflight.delete(id);
          reject(new Error(`Request timed out after ${String(timeoutMs)}ms`));
        }
      }, timeoutMs);

      this.inflight.set(id, {
        resolve: resolve as (value: unknown) => void,
        reject,
        timer,
      });

      const frame = JSON.stringify({ id, type, payload }) + '\n';

      void this.ensureConnected().then(() => {
        const { socket } = this.connection;
        if (!socket) {
          if (this.inflight.has(id)) {
            clearTimeout(timer);
            this.inflight.delete(id);
            reject(new Error('Socket not available'));
          }
          return;
        }
        socket.write(frame, (writeError) => {
          if (writeError && this.inflight.has(id)) {
            clearTimeout(timer);
            this.inflight.delete(id);
            reject(writeError);
          }
        });
      });
    });
  }

  private async ensureConnected(): Promise<void> {
    if (this.connection.state === 'connected') {
      return;
    }

    if (this.connection.state === 'connecting' || this.connection.state === 'reconnecting') {
      return new Promise<void>((resolve, reject) => {
        this.pending.push(() => {
          if (this.connection.state === 'connected') {
            resolve();
          } else {
            reject(new Error('Connection failed'));
          }
        });
      });
    }

    this.connection.state = 'connecting';
    this.connection.reconnectAttempts = 0;
    await this.connection.open();
  }
}
