export type {
  EmbeddingAdapter,
  EmbeddingMeta,
  EmbedError,
  EmbedResult,
} from './core/embedding-adapter.js';
export { cosineSimilarity } from './core/cosine-similarity.js';
export {
  growthFactor,
  initialStability,
  MAX_STABILITY,
  MIN_STABILITY,
  retention,
  strengthen,
} from './core/stability-manager.js';
export { RRF_K, rrfMerge } from './core/rrf-merge.js';
export type { RankedCandidate } from './core/rrf-merge.js';

export type {
  EntityEdge,
  EntityNode,
  EntityPathStep,
  FindEntityPathParams,
  LtmEdge,
  LtmRecord,
  StorageAdapter,
  TombstonedRecord,
} from './storage/storage-adapter.js';
export { InMemoryAdapter } from './storage/in-memory-adapter.js';
export { SqliteAdapter } from './storage/sqlite-adapter.js';

export { OpenAIEmbeddingAdapter } from './adapters/openai-embedding-adapter.js';

export { LtmCategory, LtmEngine } from './ltm-engine.js';
export type {
  ConsolidateOptions,
  EntityMention,
  EntityType,
  LtmBulkInsertEntry,
  LtmEngineStats,
  LtmInsertError,
  LtmInsertOptions,
  LtmQueryError,
  LtmQueryOptions,
  LtmQueryResult,
} from './ltm-engine.js';

export { reembedAll } from './shell/re-embed.js';
export type { ReembedError } from './shell/re-embed.js';

import type { EmbeddingAdapter } from './core/embedding-adapter.js';
import { LtmEngine } from './ltm-engine.js';
import type { StorageAdapter } from './storage/storage-adapter.js';

export function createLtmEngine(
  storage: StorageAdapter,
  embeddingAdapter: EmbeddingAdapter,
): LtmEngine {
  return new LtmEngine({ storage, embeddingAdapter });
}
