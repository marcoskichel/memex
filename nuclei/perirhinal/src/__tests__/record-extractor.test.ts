import type { LtmRecord } from '@neurome/ltm';
import { describe, expect, it } from 'vitest';

import { extractEntitiesFromRecord } from '../core/record-extractor.js';

function makeRecord(overrides: Partial<LtmRecord> = {}): LtmRecord {
  return {
    id: 1,
    data: overrides.data ?? 'Alice works at Neurome on project X.',
    metadata: overrides.metadata ?? {},
    embedding: new Float32Array([1, 0, 0]),
    embeddingMeta: { modelId: 'test', dimensions: 3 },
    tier: 'episodic',
    importance: 0.5,
    stability: 1,
    lastAccessedAt: new Date(),
    accessCount: 0,
    createdAt: new Date(),
    tombstoned: false,
    tombstonedAt: undefined,
    engramId: 'test-engram',
    ...overrides,
  };
}

describe('extractEntitiesFromRecord', () => {
  it('returns ExtractionInput when record has entities metadata', () => {
    const record = makeRecord({
      metadata: {
        entities: [
          { name: 'Alice', type: 'person' },
          { name: 'Neurome', type: 'project' },
        ],
      },
    });
    const result = extractEntitiesFromRecord(record);
    expect(result).not.toBeUndefined();
    expect(result?.record).toBe(record);
    expect(result?.prompt).toContain('Alice');
    expect(result?.prompt).toContain('Neurome');
  });

  it('returns undefined when record has no entities metadata', () => {
    const record = makeRecord({ metadata: {} });
    expect(extractEntitiesFromRecord(record)).toBeUndefined();
  });

  it('returns undefined when entities array is empty', () => {
    const record = makeRecord({ metadata: { entities: [] } });
    expect(extractEntitiesFromRecord(record)).toBeUndefined();
  });

  it('prompt includes record data', () => {
    const record = makeRecord({
      data: 'Bob joined the team today.',
      metadata: { entities: [{ name: 'Bob', type: 'person' }] },
    });
    const result = extractEntitiesFromRecord(record);
    expect(result?.prompt).toContain('Bob joined the team today.');
  });
});
