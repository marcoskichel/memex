import { describe, expect, it } from 'vitest';

import { buildEntityRankedList, filterCandidates } from '../core/query-filters.js';
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
    engramId: 'engram-1',
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

describe('filterCandidates — entity filters no longer hard-filter', () => {
  it('entityName does not exclude non-entity records from candidates', () => {
    const withEntity = makeRecord({
      id: 1,
      metadata: { entities: [{ name: 'alice', type: 'person' }] },
    });
    const without = makeRecord({ id: 2, metadata: {} });
    const result = filterCandidates([withEntity, without], { entityName: 'alice' });
    expect(result).toEqual([withEntity, without]);
  });

  it('entityType does not hard-filter candidates', () => {
    const withTool = makeRecord({
      id: 1,
      metadata: { entities: [{ name: 'pnpm', type: 'tool' }] },
    });
    const withPerson = makeRecord({
      id: 2,
      metadata: { entities: [{ name: 'alice', type: 'person' }] },
    });
    const result = filterCandidates([withTool, withPerson], { entityType: 'tool' });
    expect(result).toEqual([withTool, withPerson]);
  });
});

describe('buildEntityRankedList', () => {
  it('returns empty list when no entity filter is present', () => {
    const record = makeRecord({
      id: 1,
      metadata: { entities: [{ name: 'alice', type: 'person' }] },
    });
    const scores = new Map([[1, 0.9]]);
    expect(
      buildEntityRankedList({ candidates: [record], options: {}, semanticScores: scores }),
    ).toEqual([]);
  });

  it('ranks only entity-matching records', () => {
    const matching = makeRecord({
      id: 1,
      metadata: { entities: [{ name: 'alice', type: 'person' }] },
    });
    const nonMatching = makeRecord({ id: 2, metadata: {} });
    const scores = new Map([
      [1, 0.9],
      [2, 0.8],
    ]);
    const result = buildEntityRankedList({
      candidates: [matching, nonMatching],
      options: { entityName: 'alice' },
      semanticScores: scores,
    });
    expect(result).toEqual([{ recordId: 1, rank: 1 }]);
  });

  it('ranks by semantic score descending', () => {
    const low = makeRecord({ id: 1, metadata: { entities: [{ name: 'alice', type: 'person' }] } });
    const high = makeRecord({ id: 2, metadata: { entities: [{ name: 'alice', type: 'person' }] } });
    const scores = new Map([
      [1, 0.4],
      [2, 0.9],
    ]);
    const result = buildEntityRankedList({
      candidates: [low, high],
      options: { entityName: 'alice' },
      semanticScores: scores,
    });
    expect(result[0]).toEqual({ recordId: 2, rank: 1 });
    expect(result[1]).toEqual({ recordId: 1, rank: 2 });
  });

  it('matches entityName case-insensitively', () => {
    const record = makeRecord({
      id: 1,
      metadata: { entities: [{ name: 'alice', type: 'person' }] },
    });
    const scores = new Map([[1, 0.9]]);
    const result = buildEntityRankedList({
      candidates: [record],
      options: { entityName: 'Alice' },
      semanticScores: scores,
    });
    expect(result).toHaveLength(1);
  });

  it('filters by entityType when specified', () => {
    const tool = makeRecord({ id: 1, metadata: { entities: [{ name: 'pnpm', type: 'tool' }] } });
    const person = makeRecord({
      id: 2,
      metadata: { entities: [{ name: 'alice', type: 'person' }] },
    });
    const scores = new Map([
      [1, 0.9],
      [2, 0.8],
    ]);
    const result = buildEntityRankedList({
      candidates: [tool, person],
      options: { entityType: 'tool' },
      semanticScores: scores,
    });
    expect(result).toEqual([{ recordId: 1, rank: 1 }]);
  });
});
