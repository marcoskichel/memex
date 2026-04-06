import { okAsync, type ResultAsync } from 'neverthrow';

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
  LtmInsertError,
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
  LtmInsertError,
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

  insert(data: string, insertOptions?: LtmInsertOptions): ResultAsync<number, LtmInsertError> {
    const importance = insertOptions?.importance ?? 0;
    return this.embeddingAdapter.embed(data).map((embedData) => {
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
    });
  }

  bulkInsert(entries: LtmBulkInsertEntry[]): ResultAsync<number[], LtmInsertError> {
    return this.embedAllEntries(entries).map((records) => this.storage.bulkInsertRecords(records));
  }

  private embedAllEntries(
    entries: LtmBulkInsertEntry[],
  ): ResultAsync<Omit<LtmRecord, 'id'>[], LtmInsertError> {
    if (entries.length === 0) {
      return okAsync([]);
    }
    const [first, ...rest] = entries;
    if (!first) {
      return okAsync([]);
    }
    return this.embedEntry(first).andThen((record) =>
      this.embedAllEntries(rest).map((records) => [record, ...records]),
    );
  }

  private embedEntry(
    entry: LtmBulkInsertEntry,
  ): ResultAsync<Omit<LtmRecord, 'id'>, LtmInsertError> {
    const importance = entry.importance ?? 0;
    return this.embeddingAdapter.embed(entry.data).map((embedData) => {
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
      return entry.tier === 'semantic' ? buildSemanticRecord(base) : buildEpisodicRecord(base);
    });
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

  getRecent(limit: number): LtmRecord[] {
    return this.storage
      .getAllRecords()
      .filter((record) => !record.tombstoned)
      .toSorted((first, second) => second.createdAt.getTime() - first.createdAt.getTime())
      .slice(0, limit);
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
        minResults: queryOptions?.minResults ?? 0,
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

  consolidate(
    sourceIds: number[],
    request: ConsolidateRequest,
  ): ResultAsync<number, LtmInsertError> {
    const { data, options } = request;
    const sources = loadSources(sourceIds, this.storage);
    return this.embeddingAdapter.embed(data).map((embedData) => {
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
        ...(options?.category !== undefined && { category: options.category }),
      };
      return persistConsolidatedRecord(params, this.storage);
    });
  }

  prune(pruneOptions?: PruneOptions): { pruned: number; remaining: number } {
    return pruneRecords(this.storage, pruneOptions);
  }

  stats(): LtmEngineStats {
    return computeStats(this.storage);
  }
}
