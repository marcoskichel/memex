import type { ResultAsync } from 'neverthrow';

import type { ConsolidateParams } from './core/consolidate-helpers.js';
import {
  buildEpisodicRecord,
  buildSemanticRecord,
  loadSources,
  persistConsolidatedRecord,
} from './core/consolidate-helpers.js';
import type { EmbeddingAdapter } from './core/embedding-adapter.js';
import type {
  DecayEventParams,
  FindConsolidationOptions,
  PruneOptions,
  QueryContext,
} from './core/engine-ops.js';
import {
  computeStats,
  emitDecayEvent,
  executeQuery,
  findConsolidationCandidates,
  pruneRecords,
} from './core/engine-ops.js';
import { initialStability } from './core/stability-manager.js';
import type {
  ConsolidateRequest,
  LtmBulkInsertEntry,
  LtmEngineOptions,
  LtmEngineStats,
  LtmInsertOptions,
  LtmQueryError,
  LtmQueryOptions,
  LtmQueryResult,
  RelateParams,
} from './ltm-engine-types.js';
export type {
  ConsolidateOptions,
  ConsolidateRequest,
  LtmBulkInsertEntry,
  LtmEngineOptions,
  LtmEngineStats,
  LtmInsertOptions,
  LtmQueryError,
  LtmQueryOptions,
  LtmQueryResult,
  RelateParams,
} from './ltm-engine-types.js';
export { LtmCategory } from './ltm-engine-types.js';
export { findLiveRecord } from './core/query-helpers.js';
import type { LtmRecord, StorageAdapter, TombstonedRecord } from './storage/storage-adapter.js';

const DEFAULT_QUERY_THRESHOLD = 0.5;

export class LtmEngine {
  private storage: StorageAdapter;
  private embeddingAdapter: EmbeddingAdapter;
  private eventTarget: EventTarget;

  constructor(options: LtmEngineOptions) {
    this.storage = options.storage;
    this.embeddingAdapter = options.embeddingAdapter;
    this.eventTarget = options.eventTarget ?? new EventTarget();
  }

  async insert(data: string, insertOptions?: LtmInsertOptions): Promise<number> {
    const importance = insertOptions?.importance ?? 0;
    const embedResult = await this.embeddingAdapter.embed(data);
    const embedData = embedResult._unsafeUnwrap();
    const base = {
      data,
      metadata: insertOptions?.metadata ?? {},
      embedding: embedData.vector,
      modelId: embedData.modelId,
      dimensions: embedData.dimensions,
      importance,
      ...(insertOptions?.sessionId !== undefined && { sessionId: insertOptions.sessionId }),
      ...(insertOptions?.category !== undefined && { category: insertOptions.category }),
      ...(insertOptions?.episodeSummary !== undefined && {
        episodeSummary: insertOptions.episodeSummary,
      }),
    };
    const record =
      insertOptions?.tier === 'semantic' ? buildSemanticRecord(base) : buildEpisodicRecord(base);
    return this.storage.insertRecord(record);
  }

  async bulkInsert(entries: LtmBulkInsertEntry[]): Promise<number[]> {
    const records: Omit<LtmRecord, 'id'>[] = [];
    for (const entry of entries) {
      const importance = entry.importance ?? 0;
      const embedResult = await this.embeddingAdapter.embed(entry.data);
      const embedData = embedResult._unsafeUnwrap();
      const base = {
        data: entry.data,
        metadata: entry.metadata ?? {},
        embedding: embedData.vector,
        modelId: embedData.modelId,
        dimensions: embedData.dimensions,
        importance,
        ...(entry.sessionId !== undefined && { sessionId: entry.sessionId }),
        ...(entry.category !== undefined && { category: entry.category }),
        ...(entry.episodeSummary !== undefined && { episodeSummary: entry.episodeSummary }),
      };
      records.push(
        entry.tier === 'semantic' ? buildSemanticRecord(base) : buildEpisodicRecord(base),
      );
    }
    return this.storage.bulkInsertRecords(records);
  }

  update(id: number, patch: { metadata?: Record<string, unknown> }): boolean {
    if (!patch.metadata) {
      return false;
    }
    return this.storage.updateMetadata(id, patch.metadata);
  }

  delete(id: number): boolean {
    return this.storage.deleteRecord(id);
  }

  relate(params: RelateParams): number {
    const { fromId, toId, type } = params;
    const from = this.storage.getById(fromId);
    const to = this.storage.getById(toId);
    if (!from || !to) {
      return 0;
    }
    const now = new Date();
    return this.storage.insertEdge({
      fromId,
      toId,
      type,
      stability: initialStability((from as LtmRecord).importance),
      lastAccessedAt: now,
      createdAt: now,
    });
  }

  getById(id: number): LtmRecord | TombstonedRecord | undefined {
    return this.storage.getById(id);
  }

  query(
    nlQuery: string,
    queryOptions?: LtmQueryOptions,
  ): ResultAsync<LtmQueryResult[], LtmQueryError> {
    const threshold = queryOptions?.threshold ?? DEFAULT_QUERY_THRESHOLD;
    const shouldStrengthen = queryOptions?.strengthen ?? true;
    return this.embeddingAdapter.embed(nlQuery).andThen((queryEmbed) => {
      const context: QueryContext = {
        queryVector: queryEmbed.vector,
        queryModelId: queryEmbed.modelId,
        options: queryOptions ?? {},
        threshold,
        shouldStrengthen,
        sort: queryOptions?.sort ?? 'confidence',
        limit: queryOptions?.limit,
        storage: this.storage,
        onDecay: (record, retentionValue) => {
          emitDecayEvent({
            eventTarget: this.eventTarget,
            record,
            retentionValue,
          } satisfies DecayEventParams);
        },
      };
      return executeQuery(context);
    });
  }

  findConsolidationCandidates(options?: FindConsolidationOptions): LtmRecord[][] {
    return findConsolidationCandidates(this.storage, options);
  }

  async consolidate(sourceIds: number[], request: ConsolidateRequest): Promise<number> {
    const { data, options } = request;
    const sources = loadSources(sourceIds, this.storage);
    const embedResult = await this.embeddingAdapter.embed(data);
    const embedData = embedResult._unsafeUnwrap();
    const params: ConsolidateParams = {
      sources,
      sourceIds,
      data,
      confidence: options?.confidence ?? 1,
      preservedFacts: options?.preservedFacts ?? [],
      uncertainties: options?.uncertainties ?? [],
      deflate: options?.deflateSourceStability ?? true,
      embedding: embedData.vector,
      modelId: embedData.modelId,
      dimensions: embedData.dimensions,
    };
    return persistConsolidatedRecord(params, this.storage);
  }

  prune(pruneOptions?: PruneOptions): { pruned: number; remaining: number } {
    return pruneRecords(this.storage, pruneOptions);
  }

  stats(): LtmEngineStats {
    return computeStats(this.storage);
  }
}
