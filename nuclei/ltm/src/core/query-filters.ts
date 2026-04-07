import type { EntityMention, LtmQueryOptions, LtmQueryResult } from '../ltm-engine-types.js';
import { cosineSimilarity } from './cosine-similarity.js';
import type { LtmRecord } from '../storage/storage-adapter.js';

function matchesEntityFilter(record: LtmRecord, options: LtmQueryOptions): boolean {
  const entityName = options.entityName?.toLowerCase();
  const entityType = options.entityType;
  const entities = record.metadata.entities;
  if (!Array.isArray(entities)) {
    return false;
  }
  return (entities as EntityMention[]).some(
    (entity) =>
      (entityName === undefined || entity.name.toLowerCase().includes(entityName)) &&
      (entityType === undefined || entity.type === entityType),
  );
}

export function filterCandidates(records: LtmRecord[], options: LtmQueryOptions): LtmRecord[] {
  let candidates = records;
  if (options.tier) {
    candidates = candidates.filter((record) => record.tier === options.tier);
  }
  if (options.minImportance !== undefined) {
    const minImportance = options.minImportance;
    candidates = candidates.filter((record) => record.importance >= minImportance);
  }
  if (options.after) {
    const after = options.after;
    candidates = candidates.filter((record) => record.createdAt > after);
  }
  if (options.before) {
    const before = options.before;
    candidates = candidates.filter((record) => record.createdAt < before);
  }
  if (options.minStability !== undefined) {
    const minStability = options.minStability;
    candidates = candidates.filter((record) => record.stability >= minStability);
  }
  if (options.minAccessCount !== undefined) {
    const minAccessCount = options.minAccessCount;
    candidates = candidates.filter((record) => record.accessCount >= minAccessCount);
  }
  if (options.engramId !== undefined) {
    const engramId = options.engramId;
    candidates = candidates.filter((record) => record.engramId === engramId);
  }
  if (options.category !== undefined) {
    const category = options.category;
    candidates = candidates.filter((record) => record.category === category);
  }
  if (options.tags !== undefined && options.tags.length > 0) {
    const tags = options.tags;
    candidates = candidates.filter((record) => {
      const recordTags = record.metadata.tags;
      return (
        Array.isArray(recordTags) && tags.every((tag) => (recordTags as string[]).includes(tag))
      );
    });
  }
  if (options.entityName !== undefined || options.entityType !== undefined) {
    candidates = candidates.filter((record) => matchesEntityFilter(record, options));
  }
  return candidates;
}

export function sortResults(results: LtmQueryResult[], sort: string): void {
  switch (sort) {
    case 'recency': {
      results.sort(
        (first, second) =>
          second.record.lastAccessedAt.getTime() - first.record.lastAccessedAt.getTime(),
      );
      break;
    }
    case 'stability': {
      results.sort((first, second) => second.record.stability - first.record.stability);
      break;
    }
    case 'importance': {
      results.sort((first, second) => second.record.importance - first.record.importance);
      break;
    }
    default: {
      results.sort((first, second) => second.effectiveScore - first.effectiveScore);
    }
  }
}

export function clusterEpisodic(episodic: LtmRecord[], simThreshold: number): LtmRecord[][] {
  const clusters: LtmRecord[][] = [];
  const assigned = new Set<number>();
  for (let index = 0; index < episodic.length; index++) {
    const record = episodic[index];
    if (!record || assigned.has(record.id)) {
      continue;
    }
    const cluster: LtmRecord[] = [record];
    assigned.add(record.id);
    for (let index_ = index + 1; index_ < episodic.length; index_++) {
      const other = episodic[index_];
      if (!other || assigned.has(other.id)) {
        continue;
      }
      if (
        cluster.every(
          (member) => cosineSimilarity(member.embedding, other.embedding) >= simThreshold,
        )
      ) {
        cluster.push(other);
        assigned.add(other.id);
      }
    }
    if (cluster.length > 1) {
      clusters.push(cluster);
    }
  }
  return clusters;
}
