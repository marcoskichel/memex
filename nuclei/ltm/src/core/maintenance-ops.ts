import type { LtmEngineStats } from '../ltm-engine-types.js';
import { clusterEpisodic } from './query-filters.js';
import { retention } from './stability-manager.js';
import type { LtmRecord, StorageAdapter } from '../storage/storage-adapter.js';

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
