import type { ResultAsync } from 'neverthrow';
import { errAsync, okAsync } from 'neverthrow';

import type { LtmQueryError, LtmQueryOptions, LtmQueryResult } from '../ltm-engine-types.js';
import { injectCompanions } from './companion-injection.js';
import { buildEntityRankedList, filterCandidates, sortResults } from './query-filters.js';
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

interface RankingOutput {
  collectContext: CollectResultsContext;
  graphTraversalIds: Set<number>;
}

function buildRanking(context: QueryContext): RankingOutput {
  const { storage, onDecay } = context;
  const candidates = filterCandidates(storage.getAllRecords(), context.options);
  const maps = buildQueryMaps(candidates, context.queryVector);
  const rankedLists = buildRankedLists({ candidates, maps, storage });
  const entityRanked = buildEntityRankedList({
    candidates,
    options: context.options,
    semanticScores: maps.semanticScores,
  });
  const strategyMap = buildStrategyMap(rankedLists);
  const rrfScores = rrfMerge([
    rankedLists.semanticRanked,
    rankedLists.temporalRanked,
    rankedLists.associativeRanked,
    ...(entityRanked.length > 0 ? [entityRanked] : []),
  ]);
  return {
    collectContext: {
      rrfScores,
      maps,
      strategyMap,
      threshold: context.threshold,
      shouldStrengthen: context.shouldStrengthen,
      onDecay,
      storage,
      queryVector: context.queryVector,
    },
    graphTraversalIds: rankedLists.graphTraversalIds,
  };
}

export function executeQuery(context: QueryContext): ResultAsync<LtmQueryResult[], LtmQueryError> {
  const { storage } = context;
  const allRecords = storage.getAllRecords();
  if (allRecords.length === 0) {
    return okAsync([]);
  }
  const modelError = checkModelMatch(allRecords, context.queryModelId);
  if (modelError) {
    return errAsync(modelError);
  }
  const { collectContext, graphTraversalIds } = buildRanking(context);
  const { results, excluded } = collectQueryResults(collectContext);
  sortResults(results, context.sort);
  const withTopUp = applyTopUp({
    results,
    excluded,
    minResults: context.minResults,
    storage,
    queryVector: context.queryVector,
  });
  const limited = context.limit === undefined ? withTopUp : withTopUp.slice(0, context.limit);
  if (context.shouldStrengthen && limited.length > 0) {
    const thresholdPassingInLimited = results.filter((result) => limited.includes(result));
    strengthenResults({ results: thresholdPassingInLimited, graphTraversalIds, storage });
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
  queryVector: Float32Array;
}

export interface CollectResultsOutput {
  results: LtmQueryResult[];
  excluded: ExcludedCandidate[];
}

export function collectQueryResults(context: CollectResultsContext): CollectResultsOutput {
  const {
    rrfScores,
    maps,
    strategyMap,
    threshold,
    shouldStrengthen,
    onDecay,
    storage,
    queryVector,
  } = context;
  const results: LtmQueryResult[] = [];
  const excluded: ExcludedCandidate[] = [];
  const supersededMap = new Map<number, number[]>();
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
    const { isSuperseded, supersedingIds } = applySupersedes({
      recordId,
      storage,
      shouldStrengthen,
    });
    if (isSuperseded) {
      supersededMap.set(recordId, supersedingIds);
    }
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
        | 'companion'
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

  injectCompanions({ results, supersededMap, queryVector, storage });

  return { results, excluded };
}

export { computeStats, findConsolidationCandidates, pruneRecords } from './maintenance-ops.js';
export type { FindConsolidationOptions, PruneOptions } from './maintenance-ops.js';
