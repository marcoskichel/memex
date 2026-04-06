import type { ResultAsync } from 'neverthrow';
import { errAsync, okAsync } from 'neverthrow';

import type {
  LtmEngineStats,
  LtmQueryError,
  LtmQueryOptions,
  LtmQueryResult,
} from '../ltm-engine-types.js';
import { filterCandidates, sortResults } from './query-filters.js';
import { clusterEpisodic } from './query-filters.js';
import type { QueryMaps } from './query-helpers.js';
import {
  applySupersedes,
  buildQueryMaps,
  buildRankedLists,
  buildStrategyMap,
  DECAY_THRESHOLD,
  strengthenResults,
} from './query-helpers.js';
import { rrfMerge } from './rrf-merge.js';
import { retention } from './stability-manager.js';
import type { ExcludedCandidate } from './top-up.js';
import { applyTopUp } from './top-up.js';
import type { LtmRecord, StorageAdapter } from '../storage/storage-adapter.js';

export interface QueryContext {
  queryVector: Float32Array;
  queryModelId: string;
  options: LtmQueryOptions;
  threshold: number;
  shouldStrengthen: boolean;
  sort: string;
  limit: number | undefined;
  minResults: number;
  storage: StorageAdapter;
  onDecay: (record: LtmRecord, retentionValue: number) => void;
}

export interface DecayEventParams {
  eventTarget: EventTarget;
  record: LtmRecord;
  retentionValue: number;
}

export function emitDecayEvent(params: DecayEventParams): void {
  const { eventTarget, record, retentionValue } = params;
  eventTarget.dispatchEvent(
    new CustomEvent('ltm:record:decayed-below-threshold', {
      detail: {
        id: record.id,
        retention: retentionValue,
        stability: record.stability,
        lastAccessedAt: record.lastAccessedAt,
      },
    }),
  );
}

function checkModelMatch(records: LtmRecord[], queryModelId: string): LtmQueryError | undefined {
  const first = records[0];
  if (!first?.embeddingMeta.modelId || first.embeddingMeta.modelId !== queryModelId) {
    return {
      type: 'EMBEDDING_MODEL_MISMATCH',
      storedModelId: first?.embeddingMeta.modelId ?? '',
      queryModelId,
    };
  }
  return undefined;
}

export function executeQuery(context: QueryContext): ResultAsync<LtmQueryResult[], LtmQueryError> {
  const { storage, onDecay } = context;
  const allRecords = storage.getAllRecords();
  if (allRecords.length === 0) {
    return okAsync([]);
  }
  const modelError = checkModelMatch(allRecords, context.queryModelId);
  if (modelError) {
    return errAsync(modelError);
  }
  const candidates = filterCandidates(allRecords, context.options);
  const maps = buildQueryMaps(candidates, context.queryVector);
  const rankedLists = buildRankedLists({ candidates, maps, storage });
  const strategyMap = buildStrategyMap(rankedLists);
  const rrfScores = rrfMerge([
    rankedLists.semanticRanked,
    rankedLists.temporalRanked,
    rankedLists.associativeRanked,
  ]);
  const collectContext: CollectResultsContext = {
    rrfScores,
    maps,
    strategyMap,
    threshold: context.threshold,
    shouldStrengthen: context.shouldStrengthen,
    onDecay,
    storage,
  };
  const { results, excluded } = collectQueryResults(collectContext);
  sortResults(results, context.sort);
  const withTopUp = applyTopUp({ results, excluded, minResults: context.minResults, storage });
  const limited = context.limit === undefined ? withTopUp : withTopUp.slice(0, context.limit);
  if (context.shouldStrengthen && limited.length > 0) {
    const thresholdPassingInLimited = results.filter((result) => limited.includes(result));
    strengthenResults({
      results: thresholdPassingInLimited,
      graphTraversalIds: rankedLists.graphTraversalIds,
      storage,
    });
  }
  return okAsync(limited);
}

export interface CollectResultsContext {
  rrfScores: Map<number, number>;
  maps: QueryMaps;
  strategyMap: ReturnType<typeof buildStrategyMap>;
  threshold: number;
  shouldStrengthen: boolean;
  onDecay: (record: LtmRecord, retentionValue: number) => void;
  storage: StorageAdapter;
}

export interface CollectResultsOutput {
  results: LtmQueryResult[];
  excluded: ExcludedCandidate[];
}

export function collectQueryResults(context: CollectResultsContext): CollectResultsOutput {
  const { rrfScores, maps, strategyMap, threshold, shouldStrengthen, onDecay, storage } = context;
  const results: LtmQueryResult[] = [];
  const excluded: ExcludedCandidate[] = [];
  for (const [recordId, rrfScore] of rrfScores) {
    const record = maps.recordMap.get(recordId);
    if (!record) {
      continue;
    }
    const sim = maps.semanticScores.get(recordId) ?? 0;
    const retentionValue = maps.retentionMap.get(recordId) ?? retention(record);
    const effectiveScore = sim * retentionValue;
    if (effectiveScore < threshold) {
      if (retentionValue < DECAY_THRESHOLD) {
        onDecay(record, retentionValue);
      }
      excluded.push({ record, rrfScore, effectiveScore, sim, strategyMap });
      continue;
    }
    const isSuperseded = applySupersedes({ recordId, storage, shouldStrengthen });
    const strategies = strategyMap.get(recordId);
    const result: LtmQueryResult = {
      record,
      effectiveScore,
      rrfScore,
      isSuperseded,
      retrievalStrategies: (strategies ? [...strategies] : ['semantic']) as (
        | 'semantic'
        | 'temporal'
        | 'associative'
      )[],
    };
    if (record.tier === 'semantic' && record.metadata.confidence !== undefined) {
      result.confidence = record.metadata.confidence as number;
    }
    results.push(result);
    if (retentionValue < DECAY_THRESHOLD) {
      onDecay(record, retentionValue);
    }
  }
  return { results, excluded };
}

export const DEFAULT_SIMILARITY_THRESHOLD = 0.75;
export const DEFAULT_MIN_ACCESS_COUNT = 2;
export const DEFAULT_PRUNE_RETENTION = 0.1;

export interface PruneOptions {
  minRetention?: number;
  tier?: 'episodic' | 'semantic';
}

export interface FindConsolidationOptions {
  similarityThreshold?: number;
  minAccessCount?: number;
}

export function findConsolidationCandidates(
  storage: StorageAdapter,
  options?: FindConsolidationOptions,
): LtmRecord[][] {
  const episodic = storage
    .getAllRecords()
    .filter(
      (record) =>
        record.tier === 'episodic' &&
        record.accessCount >= (options?.minAccessCount ?? DEFAULT_MIN_ACCESS_COUNT),
    );
  return clusterEpisodic(episodic, options?.similarityThreshold ?? DEFAULT_SIMILARITY_THRESHOLD);
}

export function pruneRecords(
  storage: StorageAdapter,
  pruneOptions?: PruneOptions,
): { pruned: number; remaining: number } {
  const minRetentionValue = pruneOptions?.minRetention ?? DEFAULT_PRUNE_RETENTION;
  let allRecords = storage.getAllRecords();
  if (pruneOptions?.tier) {
    allRecords = allRecords.filter((record) => record.tier === pruneOptions.tier);
  }
  let pruned = 0;
  for (const record of allRecords) {
    if (retention(record) < minRetentionValue) {
      if (storage.edgesTo(record.id).some((edge) => edge.type === 'consolidates')) {
        storage.tombstoneRecord(record.id);
      } else {
        storage.deleteRecord(record.id);
      }
      pruned++;
    }
  }
  return { pruned, remaining: storage.getAllRecords().length };
}

export function computeStats(storage: StorageAdapter): LtmEngineStats {
  const allRecords = storage.getAllRecords();
  const total = allRecords.length;
  const episodic = allRecords.filter((record) => record.tier === 'episodic').length;
  const semantic = allRecords.filter((record) => record.tier === 'semantic').length;
  const avgStability =
    total > 0 ? allRecords.reduce((sum, record) => sum + record.stability, 0) / total : 0;
  const avgRetention =
    total > 0 ? allRecords.reduce((sum, record) => sum + retention(record), 0) / total : 0;
  const tombstoned = storage.countTombstoned();
  return { total, episodic, semantic, tombstoned, avgStability, avgRetention };
}
