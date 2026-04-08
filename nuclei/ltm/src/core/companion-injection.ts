import type { LtmQueryResult } from '../ltm-engine-types.js';
import { cosineSimilarity } from './cosine-similarity.js';
import { findLiveRecord } from './query-helpers.js';
import { retention } from './stability-manager.js';
import type { StorageAdapter } from '../storage/storage-adapter.js';

export interface CompanionInjectionParams {
  results: LtmQueryResult[];
  supersededMap: Map<number, number[]>;
  queryVector: Float32Array;
  storage: StorageAdapter;
}

export function injectCompanions(params: CompanionInjectionParams): void {
  const { results, supersededMap, queryVector, storage } = params;
  const resultIds = new Set(results.map((result) => result.record.id));

  for (const supersedingIds of supersededMap.values()) {
    for (const supId of supersedingIds) {
      if (resultIds.has(supId)) {
        continue;
      }
      const companion = findLiveRecord(supId, storage);
      if (!companion) {
        continue;
      }
      const companionScore =
        cosineSimilarity(queryVector, companion.embedding) * retention(companion);
      results.push({
        record: companion,
        effectiveScore: companionScore,
        rrfScore: 0,
        isSuperseded: false,
        retrievalStrategies: ['companion'],
      });
      resultIds.add(supId);
    }
  }
}
