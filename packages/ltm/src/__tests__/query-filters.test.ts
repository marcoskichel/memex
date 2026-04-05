import { describe, expect, it } from 'vitest';

import { filterCandidates } from '../core/query-filters.js';
import type { LtmRecord } from '../storage/storage-adapter.js';

function makeRecord(overrides: Partial<LtmRecord> & { id: number }): LtmRecord {
  const now = new Date();
  return {
    data: 'test',
    metadata: {},
    embedding: new Float32Array([0.5, 0.5, 0.5]),
    embeddingMeta: { modelId: 'test-model', dimensions: 3 },
    tier: 'episodic',
    importance: 0,
    stability: 1,
    lastAccessedAt: now,
    accessCount: 0,
    createdAt: now,
    tombstoned: false,
    tombstonedAt: undefined,
    sessionId: 'session-1',
    ...overrides,
  };
}

describe('filterCandidates - tags', () => {
  it('returns only records with the specified single tag', () => {
    const matching = makeRecord({ id: 1, metadata: { tags: ['behavioral', 'other'] } });
    const nonMatching = makeRecord({ id: 2, metadata: { tags: ['preference'] } });
    const result = filterCandidates([matching, nonMatching], { tags: ['behavioral'] });
    expect(result).toEqual([matching]);
  });

  it('returns only records containing all specified tags (AND semantics)', () => {
    const both = makeRecord({ id: 1, metadata: { tags: ['behavioral', 'preference', 'extra'] } });
    const onlyOne = makeRecord({ id: 2, metadata: { tags: ['behavioral'] } });
    const neither = makeRecord({ id: 3, metadata: { tags: ['other'] } });
    const result = filterCandidates([both, onlyOne, neither], {
      tags: ['behavioral', 'preference'],
    });
    expect(result).toEqual([both]);
  });

  it('returns all records when tags is an empty array', () => {
    const first = makeRecord({ id: 1, metadata: { tags: ['behavioral'] } });
    const second = makeRecord({ id: 2, metadata: {} });
    const result = filterCandidates([first, second], { tags: [] });
    expect(result).toEqual([first, second]);
  });

  it('returns all records when tags option is absent', () => {
    const first = makeRecord({ id: 1, metadata: { tags: ['behavioral'] } });
    const second = makeRecord({ id: 2, metadata: {} });
    const result = filterCandidates([first, second], {});
    expect(result).toEqual([first, second]);
  });

  it('excludes records with missing metadata.tags when a tags filter is specified', () => {
    const noTags = makeRecord({ id: 1, metadata: {} });
    const withTags = makeRecord({ id: 2, metadata: { tags: ['behavioral'] } });
    const result = filterCandidates([noTags, withTags], { tags: ['behavioral'] });
    expect(result).toEqual([withTags]);
  });

  it('excludes records where metadata.tags is a non-array string when a tags filter is specified', () => {
    const stringTags = makeRecord({ id: 1, metadata: { tags: 'behavioral' } });
    const arrayTags = makeRecord({ id: 2, metadata: { tags: ['behavioral'] } });
    const result = filterCandidates([stringTags, arrayTags], { tags: ['behavioral'] });
    expect(result).toEqual([arrayTags]);
  });

  it('requires records to satisfy both tags and tier filters', () => {
    const episodicWithTag = makeRecord({
      id: 1,
      tier: 'episodic',
      metadata: { tags: ['behavioral'] },
    });
    const semanticWithTag = makeRecord({
      id: 2,
      tier: 'semantic',
      metadata: { tags: ['behavioral'] },
    });
    const episodicNoTag = makeRecord({ id: 3, tier: 'episodic', metadata: {} });
    const result = filterCandidates([episodicWithTag, semanticWithTag, episodicNoTag], {
      tier: 'episodic',
      tags: ['behavioral'],
    });
    expect(result).toEqual([episodicWithTag]);
  });
});
