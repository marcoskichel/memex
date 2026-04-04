import type { EmbeddingMeta } from '../core/embedding-adapter.js';

export interface LtmRecord {
  id: number;
  data: string;
  metadata: Record<string, unknown>;
  embedding: Float32Array;
  embeddingMeta: EmbeddingMeta;
  tier: 'episodic' | 'semantic';
  importance: number;
  stability: number;
  lastAccessedAt: Date;
  accessCount: number;
  createdAt: Date;
  tombstoned: boolean;
  tombstonedAt: Date | undefined;
}

export interface LtmEdge {
  id: number;
  fromId: number;
  toId: number;
  type: 'supersedes' | 'elaborates' | 'contradicts' | 'consolidates';
  stability: number;
  lastAccessedAt: Date;
  createdAt: Date;
}

export interface TombstonedRecord {
  id: number;
  tombstoned: true;
  tombstonedAt: Date;
  data: undefined;
}

export interface UpdateEmbeddingParams {
  embedding: Float32Array;
  meta: EmbeddingMeta;
}

export interface UpdateStabilityParams {
  stability: number;
  lastAccessedAt: Date;
  accessCount: number;
}

export interface UpdateEdgeStabilityParams {
  stability: number;
  lastAccessedAt: Date;
}

export interface StorageAdapter {
  insertRecord(record: Omit<LtmRecord, 'id'>): number;
  bulkInsertRecords(records: Omit<LtmRecord, 'id'>[]): number[];
  getById(id: number): LtmRecord | TombstonedRecord | undefined;
  getAllRecords(): LtmRecord[];
  updateMetadata(id: number, patch: Record<string, unknown>): boolean;
  updateEmbedding(id: number, params: UpdateEmbeddingParams): void;
  updateStability(id: number, params: UpdateStabilityParams): void;
  tombstoneRecord(id: number): void;
  countTombstoned(): number;
  deleteRecord(id: number): boolean;

  insertEdge(edge: Omit<LtmEdge, 'id'>): number;
  getEdge(id: number): LtmEdge | undefined;
  edgesFrom(fromId: number): LtmEdge[];
  edgesTo(toId: number): LtmEdge[];
  deleteEdgesFor(recordId: number): void;
  updateEdgeStability(id: number, params: UpdateEdgeStabilityParams): void;

  acquireLock(process: string, ttlMs: number): boolean;
  releaseLock(process: string): void;
}
