import { initialStability } from './stability-manager.js';
import type { LtmRecord, StorageAdapter } from '../storage/storage-adapter.js';

export const CONFIDENCE_STABILITY_FACTOR = 0.5;

export interface ConsolidateParams {
  sources: LtmRecord[];
  sourceIds: number[];
  data: string;
  confidence: number;
  preservedFacts: string[];
  uncertainties: string[];
  deflate: boolean;
  embedding: Float32Array;
  modelId: string;
  dimensions: number;
}

export interface EpisodicRecordParams {
  data: string;
  metadata: Record<string, unknown>;
  embedding: Float32Array;
  modelId: string;
  dimensions: number;
  importance: number;
  sessionId?: string;
  category?: string;
  episodeSummary?: string;
}

export function buildEpisodicRecord(params: EpisodicRecordParams): Omit<LtmRecord, 'id'> {
  const {
    data,
    metadata,
    embedding,
    modelId,
    dimensions,
    importance,
    sessionId,
    category,
    episodeSummary,
  } = params;
  const now = new Date();
  return {
    data,
    metadata,
    embedding,
    embeddingMeta: { modelId, dimensions },
    tier: 'episodic',
    importance,
    stability: initialStability(importance),
    lastAccessedAt: now,
    accessCount: 0,
    createdAt: now,
    tombstoned: false,
    tombstonedAt: undefined,
    sessionId: sessionId ?? 'legacy',
    ...(category !== undefined && { category }),
    ...(episodeSummary !== undefined && { episodeSummary }),
  };
}

export interface SemanticRecordParams {
  data: string;
  metadata: Record<string, unknown>;
  embedding: Float32Array;
  modelId: string;
  dimensions: number;
  importance: number;
  sessionId?: string;
  category?: string;
}

export function buildSemanticRecord(params: SemanticRecordParams): Omit<LtmRecord, 'id'> {
  const { data, metadata, embedding, modelId, dimensions, importance, sessionId, category } =
    params;
  const confidence = (metadata.confidence as number | undefined) ?? 1;
  const now = new Date();
  return {
    data,
    metadata: { ...metadata, confidence },
    embedding,
    embeddingMeta: { modelId, dimensions },
    tier: 'semantic',
    importance,
    stability: initialStability(importance),
    lastAccessedAt: now,
    accessCount: 0,
    createdAt: now,
    tombstoned: false,
    tombstonedAt: undefined,
    sessionId: sessionId ?? 'legacy',
    ...(category !== undefined && { category }),
  };
}

export function loadSources(sourceIds: number[], storage: StorageAdapter): LtmRecord[] {
  const sources: LtmRecord[] = [];
  for (const id of sourceIds) {
    const record = storage.getById(id);
    if (!record || ('tombstoned' in record && record.tombstoned)) {
      continue;
    }
    sources.push(record);
  }
  return sources;
}

interface InsertConsolidatedParams {
  consolidateParams: ConsolidateParams;
  storage: StorageAdapter;
  maxImportance: number;
  newStability: number;
  now: Date;
}

function insertConsolidatedRecord(params: InsertConsolidatedParams): number {
  const { consolidateParams, storage, maxImportance, newStability, now } = params;
  const {
    data,
    confidence,
    preservedFacts,
    uncertainties,
    embedding,
    modelId,
    dimensions,
    sourceIds,
  } = consolidateParams;
  return storage.insertRecord({
    data,
    metadata: {
      confidence,
      preservedFacts,
      uncertainties,
      consolidatedAt: now.toISOString(),
      sourceIds,
    },
    embedding,
    embeddingMeta: { modelId, dimensions },
    tier: 'semantic',
    importance: maxImportance,
    stability: newStability,
    lastAccessedAt: now,
    accessCount: 0,
    createdAt: now,
    tombstoned: false,
    tombstonedAt: undefined,
    sessionId: 'legacy',
  });
}

interface LinkSourcesParams {
  newId: number;
  sourceIds: number[];
  maxImportance: number;
  now: Date;
  storage: StorageAdapter;
}

function linkSources(params: LinkSourcesParams): void {
  const { newId, sourceIds, maxImportance, now, storage } = params;
  for (const sourceId of sourceIds) {
    storage.insertEdge({
      fromId: newId,
      toId: sourceId,
      type: 'consolidates',
      stability: initialStability(maxImportance),
      lastAccessedAt: now,
      createdAt: now,
    });
  }
}

function deflateSourceStability(sources: LtmRecord[], storage: StorageAdapter): void {
  for (const source of sources) {
    storage.updateStability(source.id, {
      stability: source.stability / 2,
      lastAccessedAt: source.lastAccessedAt,
      accessCount: source.accessCount,
    });
  }
}

export function persistConsolidatedRecord(
  params: ConsolidateParams,
  storage: StorageAdapter,
): number {
  const { sources, sourceIds, confidence, deflate } = params;
  const maxImportance = Math.max(...sources.map((source) => source.importance));
  const maxStability = Math.max(...sources.map((source) => source.stability));
  const newStability = maxStability * (1 + confidence * CONFIDENCE_STABILITY_FACTOR);
  const now = new Date();
  const newId = insertConsolidatedRecord({
    consolidateParams: params,
    storage,
    maxImportance,
    newStability,
    now,
  });
  linkSources({ newId, sourceIds, maxImportance, now, storage });
  if (deflate) {
    deflateSourceStability(sources, storage);
  }
  return newId;
}
