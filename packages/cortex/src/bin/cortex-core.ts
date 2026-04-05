import { AnthropicAdapter } from '@neurokit/llm';
import type { Memory } from '@neurokit/memory';
import { createMemory } from '@neurokit/memory';
import { SqliteInsightLog } from '@neurokit/stm';

const FORCE_EXIT_TIMEOUT_MS = 30_000;

export interface CortexConfig {
  dbPath: string;
  apiKey: string;
  sessionId?: string;
}

export class ConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ConfigError';
  }
}

export function readConfig(): CortexConfig {
  const dbPath = process.env.MEMORY_DB_PATH;
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!dbPath) {
    throw new ConfigError('MEMORY_DB_PATH is required');
  }
  if (!apiKey) {
    throw new ConfigError('ANTHROPIC_API_KEY is required');
  }
  return {
    dbPath,
    apiKey,
    ...(process.env.MEMORY_SESSION_ID !== undefined && {
      sessionId: process.env.MEMORY_SESSION_ID,
    }),
  };
}

let activeMemory: Memory | undefined;
let isShuttingDown = false;

export function setActiveMemory(mem: Memory): void {
  activeMemory = mem;
}

export function resetShutdownState(): void {
  isShuttingDown = false;
  activeMemory = undefined;
}

export function shutdownOnce(): void {
  if (isShuttingDown) {
    return;
  }
  isShuttingDown = true;

  const forceExitTimer = setTimeout(() => {
    process.exit(1);
  }, FORCE_EXIT_TIMEOUT_MS);

  void activeMemory?.shutdown().then(() => {
    clearTimeout(forceExitTimer);
    process.exit(0);
  });
}

export async function main(): Promise<void> {
  let config: CortexConfig;
  try {
    config = readConfig();
  } catch (error) {
    if (error instanceof ConfigError) {
      process.stderr.write(`cortex: config error: ${error.message}\n`);
      process.exit(1);
    }
    throw error;
  }

  resetShutdownState();

  const stm = new SqliteInsightLog(config.dbPath);
  const llmAdapter = new AnthropicAdapter(config.apiKey);

  const result = await createMemory({
    storagePath: config.dbPath,
    llmAdapter,
    stm,
    ...(config.sessionId !== undefined && { sessionId: config.sessionId }),
  });

  setActiveMemory(result.memory);

  process.on('SIGTERM', shutdownOnce);
  process.on('SIGINT', shutdownOnce);

  process.stderr.write('cortex ready\n');
}
