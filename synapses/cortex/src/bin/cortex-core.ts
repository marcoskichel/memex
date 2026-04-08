import { existsSync, unlinkSync } from 'node:fs';

import { AnthropicAdapter } from '@neurome/llm';
import { OpenAIEmbeddingAdapter } from '@neurome/ltm';
import type { Memory, MemoryEvents } from '@neurome/memory';
import { createMemory } from '@neurome/memory';
import { SqliteInsightLog } from '@neurome/stm';

import { IPC_SOCKET_PATH } from '../ipc/protocol.js';
import { SocketServer } from '../ipc/socket-server.js';

const FORCE_EXIT_TIMEOUT_MS = 30_000;

function opt<K extends string, V>(key: K, value: V | undefined): Partial<Record<K, V>> {
  return value === undefined ? {} : ({ [key]: value } as Record<K, V>);
}

export interface CortexConfig {
  dbPath: string;
  apiKey: string;
  openaiApiKey: string;
  engramId?: string;
  agentProfile?: { type?: string; purpose?: string };
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
  const openaiApiKey = process.env.OPENAI_API_KEY;
  if (!dbPath) {
    throw new ConfigError('MEMORY_DB_PATH is required');
  }
  if (!apiKey) {
    throw new ConfigError('ANTHROPIC_API_KEY is required');
  }
  if (!openaiApiKey) {
    throw new ConfigError('OPENAI_API_KEY is required');
  }
  const profileType = process.env.AGENT_PROFILE_TYPE;
  const profilePurpose = process.env.AGENT_PROFILE_PURPOSE;
  const agentProfile =
    profileType !== undefined || profilePurpose !== undefined
      ? { ...opt('type', profileType), ...opt('purpose', profilePurpose) }
      : undefined;
  return {
    dbPath,
    apiKey,
    openaiApiKey,
    ...opt('engramId', process.env.NEUROME_ENGRAM_ID),
    ...opt('agentProfile', agentProfile),
  };
}

let activeMemory: Memory | undefined;
let activeServer: SocketServer | undefined;
let isShuttingDown = false;

export function setActiveMemory(mem: Memory): void {
  activeMemory = mem;
}

export function resetShutdownState(): void {
  isShuttingDown = false;
  activeMemory = undefined;
  activeServer = undefined;
}

export function shutdownOnce(): void {
  if (isShuttingDown) {
    return;
  }
  isShuttingDown = true;

  const forceExitTimer = setTimeout(() => {
    process.exit(1);
  }, FORCE_EXIT_TIMEOUT_MS);

  const shutdown = async () => {
    await activeServer?.stop();
    await activeMemory?.shutdown();
    clearTimeout(forceExitTimer);
    process.exit(0);
  };

  void shutdown();
}

export const MEMORY_EVENT_NAMES: (keyof MemoryEvents)[] = [
  'amygdala:cycle:start',
  'amygdala:cycle:end',
  'perirhinal:extraction:end',
  'amygdala:entry:scored',
  'hippocampus:consolidation:start',
  'hippocampus:consolidation:end',
  'hippocampus:false-memory-risk',
  'ltm:record:decayed-below-threshold',
  'ltm:prune:executed',
  'stm:compression:triggered',
];

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
  const embeddingAdapter = new OpenAIEmbeddingAdapter({ apiKey: config.openaiApiKey });

  const result = await createMemory({
    storagePath: config.dbPath,
    llmAdapter,
    embeddingAdapter,
    stm,
    ...opt('engramId', config.engramId),
    ...opt('agentProfile', config.agentProfile),
  });

  const { memory } = result;
  setActiveMemory(memory);

  const socketPath = IPC_SOCKET_PATH(memory.engramId);
  const server = new SocketServer(socketPath);
  activeServer = server;

  await server.start(memory);

  for (const eventName of MEMORY_EVENT_NAMES) {
    memory.events.on(eventName, (...arguments_) => {
      server.broadcast({ type: 'event', name: eventName, payload: arguments_[0] });
    });
  }

  process.on('SIGTERM', shutdownOnce);
  process.on('SIGINT', shutdownOnce);
  process.on('exit', () => {
    try {
      if (existsSync(socketPath)) {
        unlinkSync(socketPath);
      }
    } catch {}
  });

  process.stderr.write('cortex ready\n');
}
