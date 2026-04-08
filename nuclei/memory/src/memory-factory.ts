import { randomUUID } from 'node:crypto';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';

import type { EventBus as AmygdalaEventBus } from '@neurome/amygdala';
import { AmygdalaProcess } from '@neurome/amygdala';
import { HippocampusProcess } from '@neurome/hippocampus';
import type { EmbeddingAdapter } from '@neurome/ltm';
import { LtmEngine, SqliteAdapter } from '@neurome/ltm';
import { EntityExtractionProcess } from '@neurome/perirhinal';
import type { InsightLogLike } from '@neurome/stm';
import { InsightLog } from '@neurome/stm';

import { MemoryEventEmitter } from './memory-events.js';
import { MemoryImpl } from './memory-impl.js';
import type { CreateMemoryResult, MemoryConfig } from './memory-types.js';

function opt<K extends string, V>(key: K, value: V | undefined): Partial<Record<K, V>> {
  return value === undefined ? {} : ({ [key]: value } as Record<K, V>);
}

function buildAmygdala(
  config: MemoryConfig,
  deps: { ltm: LtmEngine; stm: InsightLogLike; events: MemoryEventEmitter; engramId: string },
): AmygdalaProcess {
  return new AmygdalaProcess({
    ltm: deps.ltm,
    stm: deps.stm,
    llmAdapter: config.llmAdapter,
    engramId: deps.engramId,
    ...opt('cadenceMs', config.amygdalaCadenceMs),
    ...opt('maxLLMCallsPerHour', config.maxLLMCallsPerHour),
    ...opt('lowCostModeThreshold', config.lowCostModeThreshold),
    events: deps.events as unknown as AmygdalaEventBus,
    ...opt('agentState', config.agentState),
    ...opt('agentProfile', config.agentProfile),
  });
}

function buildHippocampus(
  config: MemoryConfig,
  deps: { ltm: LtmEngine; events: MemoryEventEmitter; contextDirectory: string },
): HippocampusProcess {
  return new HippocampusProcess({
    ltm: deps.ltm,
    llmAdapter: config.llmAdapter,
    ...opt('scheduleMs', config.hippocampusScheduleMs),
    ...opt('maxLLMCallsPerHour', config.maxLLMCallsPerHour),
    contextDir: deps.contextDirectory,
    events: deps.events,
  });
}

export async function createMemory(config: MemoryConfig): Promise<CreateMemoryResult> {
  const storage = new SqliteAdapter(config.storagePath);
  const embeddingAdapter: EmbeddingAdapter = config.embeddingAdapter;
  const ltm = new LtmEngine({ storage, embeddingAdapter });
  const stm = config.stm ?? new InsightLog();
  const engramId = config.engramId ?? randomUUID();
  const contextDirectory =
    config.contextDirectory ?? path.join(path.dirname(config.storagePath), 'context');
  const engramContextDirectory = path.join(contextDirectory, engramId);

  await mkdir(engramContextDirectory, { recursive: true });

  const events = new MemoryEventEmitter();

  const amygdala = buildAmygdala(config, { ltm, stm, events, engramId });
  const hippocampus = buildHippocampus(config, { ltm, events, contextDirectory });

  const perirhinalProcess = new EntityExtractionProcess({
    storage,
    llm: config.llmAdapter,
    embedEntity: async (entity) => {
      const result = await embeddingAdapter.embed(`${entity.name} (${entity.type})`);
      return result._unsafeUnwrap().vector;
    },
  });

  amygdala.start();
  hippocampus.start();

  const memory = new MemoryImpl({
    engramId,
    events,
    ltm,
    embedder: embeddingAdapter,
    stm,
    amygdala,
    hippocampus,
    perirhinalProcess,
    contextDirectory: engramContextDirectory,
    llmAdapter: config.llmAdapter,
    forkFn: (outputPath: string) => storage.fork(outputPath),
  });
  const startupStats = await memory.getStats();
  return { memory, startupStats };
}
