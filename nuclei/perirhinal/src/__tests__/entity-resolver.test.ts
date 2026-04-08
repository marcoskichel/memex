import type { EntityNode } from '@neurome/ltm';
import { describe, expect, it } from 'vitest';

import { resolveEntityIdentity } from '../core/entity-resolver.js';
import type { ExtractedEntity } from '../core/types.js';

function makeCandidate(overrides: Partial<EntityNode> & { id: number; name: string }): EntityNode {
  return {
    type: 'person',
    embedding: new Float32Array([1, 0, 0]),
    createdAt: new Date(),
    ...overrides,
  };
}

function makeExtracted(overrides: Partial<ExtractedEntity> = {}): ExtractedEntity {
  return {
    name: 'alice',
    type: 'person',
    embedding: overrides.embedding ?? new Float32Array([1, 0, 0]),
    ...overrides,
  };
}

describe('resolveEntityIdentity', () => {
  it('exact name match returns exact resolution', () => {
    const candidate = makeCandidate({ id: 1, name: 'Alice' });
    const result = resolveEntityIdentity(makeExtracted({ name: 'alice' }), [candidate]);
    expect(result.type).toBe('exact');
    if (result.type === 'exact') {
      expect(result.entityId).toBe(1);
    }
  });

  it('exact match is case-insensitive', () => {
    const candidate = makeCandidate({ id: 2, name: 'ALICE' });
    const result = resolveEntityIdentity(makeExtracted({ name: 'alice' }), [candidate]);
    expect(result.type).toBe('exact');
    if (result.type === 'exact') {
      expect(result.entityId).toBe(2);
    }
  });

  it('same type with cosine >= 0.85 merges without LLM', () => {
    const high = new Float32Array([0.92, 0.38, 0]);
    const queryVec = new Float32Array([1, 0, 0]);
    const candidate = makeCandidate({ id: 3, name: 'bob', type: 'person', embedding: high });
    const result = resolveEntityIdentity(makeExtracted({ name: 'alice', embedding: queryVec }), [
      candidate,
    ]);
    expect(result.type).toBe('merge');
    if (result.type === 'merge') {
      expect(result.entityId).toBe(3);
    }
  });

  it('different type at cosine 0.82 returns distinct', () => {
    const vec = new Float32Array([0.82, 0.57, 0]);
    const candidate = makeCandidate({ id: 4, name: 'neurome', type: 'project', embedding: vec });
    const result = resolveEntityIdentity(
      makeExtracted({ name: 'alice', type: 'person', embedding: new Float32Array([1, 0, 0]) }),
      [candidate],
    );
    expect(result.type).toBe('distinct');
  });

  it('same type in ambiguous band [0.70, 0.85) requires LLM', () => {
    const ambiguous = new Float32Array([0.78, 0.63, 0]);
    const candidate = makeCandidate({ id: 5, name: 'ali', type: 'person', embedding: ambiguous });
    const result = resolveEntityIdentity(
      makeExtracted({ name: 'alice', type: 'person', embedding: new Float32Array([1, 0, 0]) }),
      [candidate],
    );
    expect(result.type).toBe('llm-needed');
    if (result.type === 'llm-needed') {
      expect(result.candidates).toContain(candidate);
    }
  });

  it('no candidates above threshold returns distinct', () => {
    const lowSim = new Float32Array([0, 1, 0]);
    const candidate = makeCandidate({ id: 6, name: 'bob', type: 'person', embedding: lowSim });
    const result = resolveEntityIdentity(
      makeExtracted({ name: 'alice', embedding: new Float32Array([1, 0, 0]) }),
      [candidate],
    );
    expect(result.type).toBe('distinct');
  });

  it('no candidates at all returns distinct', () => {
    const result = resolveEntityIdentity(makeExtracted(), []);
    expect(result.type).toBe('distinct');
  });
});
