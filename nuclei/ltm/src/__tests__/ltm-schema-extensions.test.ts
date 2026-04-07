import { beforeEach, describe, expect, it } from 'vitest';

import { LtmCategory } from '../ltm-engine-types.js';
import { InMemoryAdapter } from '../storage/in-memory-adapter.js';
import type { LtmRecord } from '../storage/storage-adapter.js';

function makeRecord(overrides: Partial<Omit<LtmRecord, 'id'>> = {}): Omit<LtmRecord, 'id'> {
  return {
    data: overrides.data ?? 'test data',
    metadata: overrides.metadata ?? {},
    embedding: overrides.embedding ?? new Float32Array([1, 2, 3]),
    embeddingMeta: overrides.embeddingMeta ?? { modelId: 'test-model', dimensions: 3 },
    tier: overrides.tier ?? 'episodic',
    importance: overrides.importance ?? 0.5,
    stability: overrides.stability ?? 5,
    lastAccessedAt: overrides.lastAccessedAt ?? new Date(),
    accessCount: overrides.accessCount ?? 0,
    createdAt: overrides.createdAt ?? new Date(),
    tombstoned: overrides.tombstoned ?? false,
    tombstonedAt: overrides.tombstonedAt ?? undefined,
    engramId: overrides.engramId ?? 'test-engram',
    ...(overrides.category !== undefined && { category: overrides.category }),
    ...(overrides.episodeSummary !== undefined && { episodeSummary: overrides.episodeSummary }),
  };
}

describe('ltm-schema-extensions', () => {
  let adapter: InMemoryAdapter;

  beforeEach(() => {
    adapter = new InMemoryAdapter();
  });

  it('6.1 insert with engramId → retrieved record has correct engramId', () => {
    const id = adapter.insertRecord(makeRecord({ engramId: 'engram-42' }));
    const record = adapter.getById(id) as LtmRecord;
    expect(record.engramId).toBe('engram-42');
  });

  it('6.2 query with engramId filter → only matching engram records returned', () => {
    adapter.insertRecord(makeRecord({ data: 'a', engramId: 'engram-1' }));
    adapter.insertRecord(makeRecord({ data: 'b', engramId: 'engram-2' }));
    adapter.insertRecord(makeRecord({ data: 'c', engramId: 'engram-1' }));

    const all = adapter.getAllRecords();
    const engram1 = all.filter((record) => record.engramId === 'engram-1');
    const engram2 = all.filter((record) => record.engramId === 'engram-2');
    expect(engram1).toHaveLength(2);
    expect(engram2).toHaveLength(1);
  });

  it('6.3 insert with category → retrieved record has correct category', () => {
    const id = adapter.insertRecord(makeRecord({ category: LtmCategory.WORLD_FACT }));
    const record = adapter.getById(id) as LtmRecord;
    expect(record.category).toBe('world_fact');
  });

  it('6.4 query with category filter → only matching records returned; uncategorised excluded', () => {
    adapter.insertRecord(makeRecord({ data: 'a', category: LtmCategory.WORLD_FACT }));
    adapter.insertRecord(makeRecord({ data: 'b', category: LtmCategory.USER_PREFERENCE }));
    adapter.insertRecord(makeRecord({ data: 'c' }));

    const all = adapter.getAllRecords();
    const worldFacts = all.filter((record) => record.category === LtmCategory.WORLD_FACT);
    const uncategorised = all.filter((record) => record.category === undefined);
    expect(worldFacts).toHaveLength(1);
    expect(uncategorised).toHaveLength(1);
  });

  it('6.5 LtmCategory constants export correct string values', () => {
    expect(LtmCategory.USER_PREFERENCE).toBe('user_preference');
    expect(LtmCategory.WORLD_FACT).toBe('world_fact');
    expect(LtmCategory.TASK_CONTEXT).toBe('task_context');
    expect(LtmCategory.AGENT_BELIEF).toBe('agent_belief');
  });

  it('6.6 insert with episodeSummary → survives round-trip', () => {
    const summary = 'User said they prefer dark mode in the settings panel.';
    const id = adapter.insertRecord(makeRecord({ episodeSummary: summary }));
    const record = adapter.getById(id) as LtmRecord;
    expect(record.episodeSummary).toBe(summary);
  });

  it('6.7 semantic insert via tier semantic → stored with tier semantic; confidence defaults to 1.0', () => {
    const id = adapter.insertRecord(makeRecord({ tier: 'semantic', metadata: {} }));
    const record = adapter.getById(id) as LtmRecord;
    expect(record.tier).toBe('semantic');
  });

  it('6.8 mixed-tier bulkInsert → each record has correct tier', () => {
    const ids = adapter.bulkInsertRecords([
      makeRecord({ data: 'episodic-one', tier: 'episodic' }),
      makeRecord({ data: 'semantic-one', tier: 'semantic' }),
    ]);
    expect(ids).toHaveLength(2);
    const firstId = ids[0];
    const secondId = ids[1];
    if (!firstId || !secondId) {
      throw new Error('expected ids');
    }
    const first = adapter.getById(firstId) as LtmRecord;
    const second = adapter.getById(secondId) as LtmRecord;
    expect(first.tier).toBe('episodic');
    expect(second.tier).toBe('semantic');
  });

  it('6.9 records with no engramId return legacy sentinel', () => {
    const id = adapter.insertRecord(makeRecord({ engramId: 'legacy' }));
    const record = adapter.getById(id) as LtmRecord;
    expect(record.engramId).toBe('legacy');
  });

  it('6.10 all new fields are optional at the record level (category, episodeSummary)', () => {
    const id = adapter.insertRecord(makeRecord());
    const record = adapter.getById(id) as LtmRecord;
    expect(record.category).toBeUndefined();
    expect(record.episodeSummary).toBeUndefined();
  });
});
