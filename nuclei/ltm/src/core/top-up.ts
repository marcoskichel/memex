import type { LtmQueryResult } from '../ltm-engine-types.js';
import { injectCompanions } from './companion-injection.js';
import { applySupersedes } from './query-helpers.js';
import type { LtmRecord, StorageAdapter } from '../storage/storage-adapter.js';

export interface ExcludedCandidate {
  record: LtmRecord;
  rrfScore: number;
  effectiveScore: number;
  sim: number;
  strategyMap: Map<number, Set<'semantic' | 'temporal' | 'associative'>>;
}

export interface TopUpContext {
  results: LtmQueryResult[];
  excluded: ExcludedCandidate[];
  minResults: number;
  storage: StorageAdapter;
  queryVector: Float32Array;
}

const TOP_UP_MIN_COSINE_SIM = 0.05;

export function applyTopUp(context: TopUpContext): LtmQueryResult[] {
  const { results, excluded, minResults, storage, queryVector } = context;
  if (results.length >= minResults) {
    return results;
  }
  const eligible = excluded
    .filter((candidate) => candidate.sim > TOP_UP_MIN_COSINE_SIM)
    .toSorted((first, second) => second.effectiveScore - first.effectiveScore);
  const topUp: LtmQueryResult[] = [];
  const supersededMap = new Map<number, number[]>();
  for (const candidate of eligible) {
    if (results.length + topUp.length >= minResults) {
      break;
    }
    const { record, rrfScore, effectiveScore, strategyMap } = candidate;
    const { isSuperseded, supersedingIds } = applySupersedes({
      recordId: record.id,
      storage,
      shouldStrengthen: false,
    });
    if (isSuperseded) {
      supersededMap.set(record.id, supersedingIds);
    }
    const strategies = strategyMap.get(record.id);
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
    topUp.push(result);
  }

  const allResults = [...results, ...topUp];
  injectCompanions({ results: allResults, supersededMap, queryVector, storage });

  return allResults;
}
