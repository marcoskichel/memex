import type {
  EmbeddingAdapter,
  EntityNode,
  EntityPathStep,
  LtmEngine,
  LtmQueryResult,
} from '@neurome/ltm';
import { errAsync, okAsync } from 'neverthrow';
import { describe, expect, it, vi } from 'vitest';

import { ENTITY_CONTEXT_TOP_K, ENTITY_PATH_RELIABILITY_THRESHOLD } from '../memory-types.js';
import { enrichRecallResults, resolveHintSeeds, safeEnrich } from '../recall-enrichment.js';

function vec(...values: number[]): Float32Array {
  return new Float32Array(values);
}

function makeEntity(id: number, embedding: Float32Array): EntityNode {
  return { id, name: `entity-${String(id)}`, type: 'person', embedding, createdAt: new Date() };
}

function makeStep(entity: EntityNode): EntityPathStep {
  return { entity, via: undefined };
}

function makeRecord(id: number): LtmQueryResult {
  return {
    record: {
      id,
      data: `data-${String(id)}`,
      metadata: {},
      embedding: vec(0, 0, 0),
      embeddingMeta: { modelId: 'mock', dimensions: 3 },
      tier: 'episodic',
      importance: 0,
      stability: 1,
      lastAccessedAt: new Date(),
      accessCount: 0,
      createdAt: new Date(),
      tombstoned: false,
      tombstonedAt: undefined,
      engramId: 'test',
    },
    effectiveScore: 0.9,
    rrfScore: 0.9,
    retrievalStrategies: ['semantic'],
    isSuperseded: false,
  };
}

function makeLtm(overrides: Partial<LtmEngine> = {}): LtmEngine {
  return {
    getEntitiesForRecord: vi.fn(() => []),
    findEntityPath: vi.fn(() => []),
    findEntityByEmbedding: vi.fn(() => []),
    ...overrides,
  } as unknown as LtmEngine;
}

function makeEmbedder(vector: Float32Array = vec(1, 0, 0)): EmbeddingAdapter {
  return {
    modelId: 'mock',
    dimensions: 3,
    embed: vi.fn(() => okAsync({ vector, modelId: 'mock', dimensions: 3 })),
  };
}

describe('enrichRecallResults', () => {
  it('returns result without entityContext when record has no linked entities', () => {
    const results = [makeRecord(1)];
    const ltm = makeLtm({ getEntitiesForRecord: vi.fn(() => []) });

    const enriched = enrichRecallResults({
      results,
      queryEmbedding: vec(1, 0, 0),
      seedEntityIds: [10],
      ltm,
    });

    expect(enriched[0]?.entityContext).toBeUndefined();
  });

  it('selects entity with highest cosine similarity to query embedding', () => {
    const queryEmbedding = vec(1, 0, 0);
    const entityA = makeEntity(1, vec(1, 0, 0));
    const entityB = makeEntity(2, vec(0, 1, 0));
    const results = [makeRecord(1)];
    const ltm = makeLtm({ getEntitiesForRecord: vi.fn(() => [entityA, entityB]) });

    const enriched = enrichRecallResults({
      results,
      queryEmbedding,
      seedEntityIds: [],
      ltm,
    });

    expect(enriched[0]?.entityContext?.selectedEntity.id).toBe(1);
  });

  it('picks shortest path from any seed; originEntity matches path start', () => {
    const entity = makeEntity(5, vec(1, 0, 0));
    const origin = makeEntity(10, vec(0, 1, 0));
    const shortPath = [makeStep(origin), makeStep(entity)];
    const longPath = [
      makeStep(makeEntity(20, vec(0, 0, 1))),
      makeStep(makeEntity(21, vec(0, 0, 1))),
      makeStep(entity),
    ];
    const results = [makeRecord(1)];
    const ltm = makeLtm({
      getEntitiesForRecord: vi.fn(() => [entity]),
      findEntityPath: vi.fn((params: { fromId: number }) =>
        params.fromId === 10 ? shortPath : longPath,
      ),
    });

    const enriched = enrichRecallResults({
      results,
      queryEmbedding: vec(1, 0, 0),
      seedEntityIds: [10, 20],
      ltm,
    });

    expect(enriched[0]?.entityContext?.navigationPath).toHaveLength(2);
    expect(enriched[0]?.entityContext?.originEntity?.id).toBe(10);
  });

  it('sets pathReliability ok for path within threshold', () => {
    const entity = makeEntity(5, vec(1, 0, 0));
    const origin = makeEntity(10, vec(0, 1, 0));
    const path = Array.from({ length: ENTITY_PATH_RELIABILITY_THRESHOLD + 1 }, (_, index) =>
      makeStep(index === 0 ? origin : makeEntity(index + 20, vec(0, 0, 1))),
    );
    const results = [makeRecord(1)];
    const ltm = makeLtm({
      getEntitiesForRecord: vi.fn(() => [entity]),
      findEntityPath: vi.fn(() => path),
    });

    const enriched = enrichRecallResults({
      results,
      queryEmbedding: vec(1, 0, 0),
      seedEntityIds: [10],
      ltm,
    });

    expect(enriched[0]?.entityContext?.pathReliability).toBe('ok');
  });

  it('sets pathReliability degraded when path exceeds threshold', () => {
    const entity = makeEntity(5, vec(1, 0, 0));
    const origin = makeEntity(10, vec(0, 1, 0));
    const path = Array.from({ length: ENTITY_PATH_RELIABILITY_THRESHOLD + 2 }, (_, index) =>
      makeStep(index === 0 ? origin : makeEntity(index + 20, vec(0, 0, 1))),
    );
    const results = [makeRecord(1)];
    const ltm = makeLtm({
      getEntitiesForRecord: vi.fn(() => [entity]),
      findEntityPath: vi.fn(() => path),
    });

    const enriched = enrichRecallResults({
      results,
      queryEmbedding: vec(1, 0, 0),
      seedEntityIds: [10],
      ltm,
    });

    expect(enriched[0]?.entityContext?.pathReliability).toBe('degraded');
  });

  it('sets navigationPath and originEntity to undefined when no path found', () => {
    const entity = makeEntity(5, vec(1, 0, 0));
    const results = [makeRecord(1)];
    const ltm = makeLtm({
      getEntitiesForRecord: vi.fn(() => [entity]),
      findEntityPath: vi.fn(() => []),
    });

    const enriched = enrichRecallResults({
      results,
      queryEmbedding: vec(1, 0, 0),
      seedEntityIds: [10],
      ltm,
    });

    expect(enriched[0]?.entityContext?.navigationPath).toBeUndefined();
    expect(enriched[0]?.entityContext?.originEntity).toBeUndefined();
  });

  it(`enriches only top ${String(ENTITY_CONTEXT_TOP_K)} results; rest pass through unchanged`, () => {
    const entity = makeEntity(1, vec(1, 0, 0));
    const results = Array.from({ length: ENTITY_CONTEXT_TOP_K + 2 }, (_, index) =>
      makeRecord(index),
    );
    const getEntities = vi.fn(() => [entity]);
    const ltm = makeLtm({ getEntitiesForRecord: getEntities });

    const enriched = enrichRecallResults({
      results,
      queryEmbedding: vec(1, 0, 0),
      seedEntityIds: [],
      ltm,
    });

    expect(getEntities).toHaveBeenCalledTimes(ENTITY_CONTEXT_TOP_K);
    expect(enriched).toHaveLength(results.length);
    for (let index = ENTITY_CONTEXT_TOP_K; index < enriched.length; index++) {
      expect(enriched[index]?.entityContext).toBeUndefined();
    }
  });
});

describe('resolveHintSeeds', () => {
  it('returns vectors for successfully embedded hints', async () => {
    const vector = vec(1, 0, 0);
    const embedder = makeEmbedder(vector);

    const result = await resolveHintSeeds(['Alice', 'Bob'], embedder);

    expect(result).toHaveLength(2);
    expect(result[0]).toEqual(vector);
  });

  it('excludes hints where embed fails', async () => {
    const embedder: EmbeddingAdapter = {
      modelId: 'mock',
      dimensions: 3,
      embed: vi
        .fn()
        .mockReturnValueOnce(okAsync({ vector: vec(1, 0, 0), modelId: 'mock', dimensions: 3 }))
        .mockReturnValueOnce(errAsync({ type: 'EMBED_EMPTY_INPUT' as const })),
    };

    const result = await resolveHintSeeds(['Alice', 'Bob'], embedder);

    expect(result).toHaveLength(1);
  });
});

describe('safeEnrich', () => {
  it('uses currentEntityIds as seeds without embedding hints', async () => {
    const entity = makeEntity(5, vec(1, 0, 0));
    const getEntities = vi.fn(() => [entity]);
    const ltm = makeLtm({ getEntitiesForRecord: getEntities });
    const embedder = makeEmbedder();
    const results = [makeRecord(1)];

    const enriched = await safeEnrich({
      results,
      nlQuery: 'query',
      options: { currentEntityIds: [5] },
      embedder,
      ltm,
    });

    expect(getEntities).toHaveBeenCalledWith(1);
    expect(enriched[0]?.entityContext).toBeDefined();
  });

  it('embeds each hint and resolves entities via findEntityByEmbedding', async () => {
    const entity = makeEntity(5, vec(1, 0, 0));
    const findByEmbedding = vi.fn(() => [entity]);
    const ltm = makeLtm({
      getEntitiesForRecord: vi.fn(() => [entity]),
      findEntityByEmbedding: findByEmbedding,
    });
    const embedSpy = vi.fn(() => okAsync({ vector: vec(1, 0, 0), modelId: 'mock', dimensions: 3 }));
    const embedder: EmbeddingAdapter = { modelId: 'mock', dimensions: 3, embed: embedSpy };
    const results = [makeRecord(1)];

    await safeEnrich({
      results,
      nlQuery: 'query',
      options: { currentEntityHint: ['Alice', 'Bob'] },
      embedder,
      ltm,
    });

    expect(embedSpy).toHaveBeenCalledTimes(3);
    expect(findByEmbedding).toHaveBeenCalledTimes(2);
  });

  it('deduplicates entity IDs resolved from multiple hints', async () => {
    const entity = makeEntity(5, vec(1, 0, 0));
    const getEntities = vi.fn(() => [entity]);
    const ltm = makeLtm({
      getEntitiesForRecord: getEntities,
      findEntityByEmbedding: vi.fn(() => [entity]),
    });
    const embedder = makeEmbedder();
    const results = [makeRecord(1)];

    const enriched = await safeEnrich({
      results,
      nlQuery: 'query',
      options: { currentEntityHint: ['Alice', 'Bob'] },
      embedder,
      ltm,
    });

    const context = enriched[0]?.entityContext;
    expect(context).toBeDefined();
    expect(context?.entityResolved).toBe(true);
  });

  it('returns original results when embed fails', async () => {
    const embedder: EmbeddingAdapter = {
      modelId: 'mock',
      dimensions: 3,
      embed: vi.fn(() => errAsync({ type: 'EMBED_EMPTY_INPUT' as const })),
    };
    const results = [makeRecord(1)];

    const enriched = await safeEnrich({
      results,
      nlQuery: 'query',
      options: { currentEntityIds: [5] },
      embedder,
      ltm: makeLtm(),
    });

    expect(enriched).toHaveLength(1);
    expect(enriched[0]?.entityContext).toBeUndefined();
  });
});
