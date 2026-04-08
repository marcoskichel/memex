import type { ChildProcess } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import type {
  InsertMemoryOptions,
  LogInsightOptions,
  McpServerConfig,
  RecallParams,
  RecallResult,
} from './types.js';

const FORCE_KILL_TIMEOUT_MS = 10_000;

interface Axon {
  recall(query: string, options?: RecallParams): Promise<RecallResult[]>;
  logInsight(payload: LogInsightOptions): void;
  insertMemory(data: string, options?: InsertMemoryOptions): Promise<number>;
  getRecent(limit: number): Promise<unknown[]>;
  getStats(): Promise<unknown>;
  fork(outputPath: string): Promise<string>;
  disconnect(): void;
}

interface EngramDeps {
  engramId: string;
  db: string;
  axon: Axon;
  cortex: ChildProcess;
}

export class Engram {
  private readonly deps: EngramDeps;

  constructor(deps: EngramDeps) {
    this.deps = deps;
  }

  get engramId(): string {
    return this.deps.engramId;
  }

  recall(query: string, options?: RecallParams): Promise<RecallResult[]> {
    return this.deps.axon.recall(query, options);
  }

  logInsight(payload: LogInsightOptions): void {
    this.deps.axon.logInsight(payload);
  }

  insertMemory(data: string, options?: InsertMemoryOptions): Promise<number> {
    return this.deps.axon.insertMemory(data, options);
  }

  getRecent(limit: number): Promise<unknown[]> {
    return this.deps.axon.getRecent(limit);
  }

  getStats(): Promise<unknown> {
    return this.deps.axon.getStats();
  }

  fork(outputPath: string): Promise<string> {
    return this.deps.axon.fork(outputPath);
  }

  asMcpServer(): McpServerConfig {
    const dendriteBin = fileURLToPath(new URL('bin/dendrite.js', import.meta.url));
    return {
      type: 'stdio',
      command: 'node',
      args: [dendriteBin],
      env: {
        NEUROME_ENGRAM_ID: this.deps.engramId,
        MEMORY_DB_PATH: this.deps.db,
      },
    };
  }

  async close(): Promise<void> {
    this.deps.axon.disconnect();
    await new Promise<void>((resolve) => {
      const forceKillTimer = setTimeout(() => {
        this.deps.cortex.kill('SIGKILL');
        resolve();
      }, FORCE_KILL_TIMEOUT_MS);
      this.deps.cortex.once('exit', () => {
        clearTimeout(forceKillTimer);
        resolve();
      });
      this.deps.cortex.kill('SIGTERM');
    });
  }
}
