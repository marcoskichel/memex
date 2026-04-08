import { randomUUID } from 'node:crypto';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';

import type { EventBus as AmygdalaEventBus } from '@neurome/amygdala';
import { AmygdalaProcess } from '@neurome/amygdala';
import { HippocampusProcess } from '@neurome/hippocampus';
import type { EmbeddingAdapter } from '@neurome/ltm';
import { LtmEngine, SqliteAdapter } from '@neurome/ltm';
import type { InsightLogLike } from '@neurome/stm';
import { InsightLog } from '@neurome/stm';

import { MemoryEventEmitter } from './memory-events.js';
import { MemoryImpl } from './memory-impl.js';
import type { CreateMemoryResult, MemoryConfig } from './memory-types.js';

function buildAmygdala(
  config: MemoryConfig,
  deps: { ltm: LtmEngine; stm: InsightLogLike; events: MemoryEventEmitter; engramId: string },
): AmygdalaProcess {
  return new AmygdalaProcess({
    ltm: deps.ltm,
    stm: deps.stm,
    llmAdapter: config.llmAdapter,
    engramId: deps.engramId,
    ...(config.amygdalaCadenceMs !== undefined && { cadenceMs: config.amygdalaCadenceMs }),
    ...(config.maxLLMCallsPerHour !== undefined && {
      maxLLMCallsPerHour: config.maxLLMCallsPerHour,
    }),
    ...(config.lowCostModeThreshold !== undefined && {
      lowCostModeThreshold: config.lowCostModeThreshold,
    }),
    events: deps.events as unknown as AmygdalaEventBus,
    ...(config.agentState !== undefined && { agentState: config.agentState }),
  });
}

function buildHippocampus(
  config: MemoryConfig,
  deps: { ltm: LtmEngine; events: MemoryEventEmitter; contextDirectory: string },
): HippocampusProcess {
  return new HippocampusProcess({
    ltm: deps.ltm,
    llmAdapter: config.llmAdapter,
    ...(config.hippocampusScheduleMs !== undefined && { scheduleMs: config.hippocampusScheduleMs }),
    ...(config.maxLLMCallsPerHour !== undefined && {
      maxLLMCallsPerHour: config.maxLLMCallsPerHour,
    }),
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
    contextDirectory: engramContextDirectory,
    llmAdapter: config.llmAdapter,
    forkFn: (outputPath: string) => storage.fork(outputPath),
  });
  const startupStats = await memory.getStats();
  return { memory, startupStats };
}
