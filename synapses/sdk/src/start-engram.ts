import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import { AxonClient } from '@neurome/axon';
import Database from 'better-sqlite3';

import { Engram } from './engram.js';
import type { StartEngramConfig } from './types.js';

function opt<K extends string, V>(key: K, value: V | undefined): Partial<Record<K, V>> {
  return value === undefined ? {} : ({ [key]: value } as Record<K, V>);
}

const CORTEX_STARTUP_TIMEOUT_MS = 30_000;
const CORTEX_CONNECT_RETRIES = 10;
const CORTEX_CONNECT_RETRY_DELAY_MS = 200;

function toError(value: unknown): Error {
  return value instanceof Error ? value : new Error(String(value));
}

function forkDatabase(source: string, destination: string): Promise<void> {
  return new Promise((resolve, reject) => {
    try {
      const db = new Database(source, { readonly: true });
      void db.backup(destination).then(
        () => {
          db.close();
          resolve();
        },
        (error: unknown) => {
          reject(toError(error));
        },
      );
    } catch (error) {
      reject(toError(error));
    }
  });
}

function waitForCortexReady(cortex: ReturnType<typeof spawn>, timeoutMs: number): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`cortex did not become ready within ${String(timeoutMs)}ms`));
    }, timeoutMs);

    const onData = (chunk: Buffer): void => {
      if (chunk.toString().includes('cortex ready')) {
        clearTimeout(timer);
        cortex.stderr?.off('data', onData);
        resolve();
      }
    };

    cortex.stderr?.on('data', onData);

    cortex.once('exit', (code) => {
      clearTimeout(timer);
      reject(new Error(`cortex exited with code ${String(code)} before signalling ready`));
    });
  });
}

interface ConnectOptions {
  retries: number;
  delayMs: number;
}

async function connectWithRetry(axon: AxonClient, options: ConnectOptions): Promise<void> {
  for (let attempt = 0; attempt <= options.retries; attempt++) {
    try {
      await axon.getStats();
      return;
    } catch {
      if (attempt === options.retries) {
        throw new Error('axon could not connect to cortex after retries');
      }
      await new Promise<void>((resolve) => setTimeout(resolve, options.delayMs));
    }
  }
}

export async function startEngram(config: StartEngramConfig): Promise<Engram> {
  const { engramId, db, source } = config;

  if (source !== undefined) {
    await forkDatabase(source, db);
  }

  const cortexBin = fileURLToPath(new URL('bin/cortex.js', import.meta.url));

  const cortex = spawn('node', [cortexBin], {
    env: {
      ...process.env,
      MEMORY_DB_PATH: db,
      NEUROME_ENGRAM_ID: engramId,
      ...opt('ANTHROPIC_API_KEY', config.anthropicApiKey),
      ...opt('OPENAI_API_KEY', config.openaiApiKey),
      ...opt('AGENT_PROFILE_TYPE', config.agentProfile?.type),
      ...opt('AGENT_PROFILE_PURPOSE', config.agentProfile?.purpose),
    },
    stdio: ['ignore', 'ignore', 'pipe'],
  });

  await waitForCortexReady(cortex, CORTEX_STARTUP_TIMEOUT_MS);

  const axon = new AxonClient(engramId);
  await connectWithRetry(axon, {
    retries: CORTEX_CONNECT_RETRIES,
    delayMs: CORTEX_CONNECT_RETRY_DELAY_MS,
  });

  return new Engram({ engramId, db, axon, cortex });
}
