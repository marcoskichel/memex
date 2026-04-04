import type { EmbeddingAdapter, EmbedError } from './core/embedding-adapter.js';
import type { LtmEdge, LtmRecord, StorageAdapter } from './storage/storage-adapter.js';

export interface LtmQueryOptions {
  limit?: number;
  threshold?: number;
  strengthen?: boolean;
  tier?: 'episodic' | 'semantic';
  minImportance?: number;
  after?: Date;
  before?: Date;
  minStability?: number;
  minAccessCount?: number;
  sort?: 'confidence' | 'recency' | 'stability' | 'importance';
}

export interface LtmQueryResult {
  record: LtmRecord;
  effectiveScore: number;
  rrfScore: number;
  retrievalStrategies: ('semantic' | 'temporal' | 'associative')[];
  isSuperseded: boolean;
  confidence?: number;
}

export type LtmQueryError =
  | EmbedError
  | { type: 'EMBEDDING_MODEL_MISMATCH'; storedModelId: string; queryModelId: string };

export interface ConsolidateOptions {
  deflateSourceStability?: boolean;
  confidence?: number;
  preservedFacts?: string[];
  uncertainties?: string[];
}

export interface LtmEngineStats {
  total: number;
  episodic: number;
  semantic: number;
  tombstoned: number;
  avgStability: number;
  avgRetention: number;
}

export interface LtmEngineOptions {
  storage: StorageAdapter;
  embeddingAdapter: EmbeddingAdapter;
  eventTarget?: EventTarget;
}

export interface RelateParams {
  fromId: number;
  toId: number;
  type: LtmEdge['type'];
}

export interface ConsolidateRequest {
  data: string;
  options?: ConsolidateOptions;
}
