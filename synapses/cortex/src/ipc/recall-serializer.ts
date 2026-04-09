import type { LtmQueryResult } from '@neurome/ltm';
import type { MemoryRecallResult } from '@neurome/memory';

import type { MemoryEntry, RecallResult } from './protocol.js';

const HASH_TAG_PATTERN = /^[\da-f]{64}$/i;
const ISO_DATE_LENGTH = 10;
const HIGH_RELEVANCE_THRESHOLD = 0.7;
const MEDIUM_RELEVANCE_THRESHOLD = 0.5;

function bucketRelevance(effectiveScore: number): 'high' | 'medium' | 'low' {
  if (effectiveScore >= HIGH_RELEVANCE_THRESHOLD) {
    return 'high';
  }
  if (effectiveScore >= MEDIUM_RELEVANCE_THRESHOLD) {
    return 'medium';
  }
  return 'low';
}

function toMemoryEntry(result: LtmQueryResult, superseded?: true): MemoryEntry {
  const { record, effectiveScore } = result;
  const meta = record.metadata as { tags?: unknown; entities?: unknown };
  const rawTags = Array.isArray(meta.tags) ? (meta.tags as string[]) : [];
  const tags = rawTags.filter((tag) => !HASH_TAG_PATTERN.test(tag));
  const entities = Array.isArray(meta.entities) ? (meta.entities as MemoryEntry['entities']) : [];
  const entry: MemoryEntry = {
    memory: record.data,
    tier: record.tier,
    relevance: bucketRelevance(effectiveScore),
    tags,
    entities,
    recordedAt: record.createdAt.toISOString().slice(0, ISO_DATE_LENGTH),
  };
  if (superseded) {
    entry.superseded = true;
  }
  return entry;
}

export function serializeRecallResults(results: MemoryRecallResult[]): RecallResult[] {
  const companionById = new Map<number, LtmQueryResult>();
  const supersededResults: LtmQueryResult[] = [];
  const normalResults: LtmQueryResult[] = [];

  for (const result of results) {
    if (result.retrievalStrategies.includes('companion')) {
      companionById.set(result.record.id, result);
    } else if (result.isSuperseded) {
      supersededResults.push(result);
    } else {
      normalResults.push(result);
    }
  }

  const output: RecallResult[] = [];
  const usedCompanionIds = new Set<number>();

  for (const superseded of supersededResults) {
    const companionId = superseded.supersedingIds.find((id) => companionById.has(id));
    if (companionId === undefined) {
      output.push(toMemoryEntry(superseded, true));
      continue;
    }
    const companion = companionById.get(companionId);
    if (companion === undefined) {
      output.push(toMemoryEntry(superseded, true));
      continue;
    }
    output.push({
      type: 'changed',
      current: toMemoryEntry(companion),
      supersedes: toMemoryEntry(superseded),
    });
    usedCompanionIds.add(companionId);
  }

  for (const result of normalResults) {
    output.push(toMemoryEntry(result));
  }

  for (const [id, companion] of companionById) {
    if (!usedCompanionIds.has(id)) {
      output.push(toMemoryEntry(companion));
    }
  }

  return output;
}
