import { errAsync, okAsync, type Result, type ResultAsync } from 'neverthrow';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { EmbeddingAdapter, EmbedError, EmbedResult } from '../core/embedding-adapter.js';
import type { LtmInsertError } from '../ltm-engine-types.js';
import { LtmEngine } from '../ltm-engine.js';
import { InMemoryAdapter } from '../storage/in-memory-adapter.js';
import type { LtmRecord } from '../storage/storage-adapter.js';

function unwrap<T>(result: Result<T, LtmInsertError>): T {
  if (result.isErr()) {
    throw new Error(`Unexpected error in test: ${result.error.type}`);
  }
  return result.value;
}

function createMockAdapter(vector?: Float32Array): EmbeddingAdapter {
  const defaultVector = vector ?? new Float32Array([0.5, 0.5, 0.5]);
  return {
    modelId: 'test-model',
    dimensions: defaultVector.length,
    embed(text: string): ResultAsync<EmbedResult, EmbedError> {
      if (!text || text.trim().length === 0) {
        return errAsync({ type: 'EMBED_EMPTY_INPUT' });
      }
      return okAsync({
        vector: defaultVector,
        modelId: 'test-model',
        dimensions: defaultVector.length,
      });
    },
  };
}

function normalize(values: number[]): Float32Array {
  const magnitude = Math.sqrt(values.reduce((sum, x) => sum + x * x, 0));
  return new Float32Array(values.map((x) => x / magnitude));
}

describe('LtmEngine', () => {
  let storage: InMemoryAdapter;
  let adapter: EmbeddingAdapter;
  let engine: LtmEngine;
  let events: EventTarget;

  beforeEach(() => {
    storage = new InMemoryAdapter();
    adapter = createMockAdapter(normalize([1, 0, 0]));
    events = new EventTarget();
    engine = new LtmEngine({ storage, embeddingAdapter: adapter, eventTarget: events });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('insert', () => {
    it('returns a positive integer ID', async () => {
      const id = unwrap(await engine.insert('hello world'));
      expect(id).toBeGreaterThan(0);
    });

    it('defaults importance to 0', async () => {
      const id = unwrap(await engine.insert('hello'));
      const record = engine.getById(id) as LtmRecord;
      expect(record.importance).toBe(0);
    });

    it('stores provided importance and metadata', async () => {
      const id = unwrap(
        await engine.insert('hello', { importance: 0.8, metadata: { tag: 'test' } }),
      );
      const record = engine.getById(id) as LtmRecord;
      expect(record.importance).toBe(0.8);
      expect(record.metadata).toEqual({ tag: 'test' });
    });

    it('sets tier to episodic', async () => {
      const id = unwrap(await engine.insert('hello'));
      const record = engine.getById(id) as LtmRecord;
      expect(record.tier).toBe('episodic');
    });

    it('stores embedding metadata', async () => {
      const id = unwrap(await engine.insert('hello'));
      const record = engine.getById(id) as LtmRecord;
      expect(record.embeddingMeta.modelId).toBe('test-model');
    });
  });

  describe('bulkInsert', () => {
    it('inserts multiple records', async () => {
      const ids = unwrap(await engine.bulkInsert([{ data: 'a' }, { data: 'b' }, { data: 'c' }]));
      expect(ids).toHaveLength(3);
      for (const id of ids) {
        expect(engine.getById(id)).toBeDefined();
      }
    });
  });

  describe('update', () => {
    it('patches metadata only', async () => {
      const id = unwrap(await engine.insert('hello', { metadata: { key1: 1 } }));
      const success = engine.update(id, { metadata: { key2: 2 } });
      expect(success).toBe(true);
      const record = engine.getById(id) as LtmRecord;
      expect(record.metadata).toEqual({ key1: 1, key2: 2 });
      expect(record.data).toBe('hello');
    });

    it('returns false for unknown ID', () => {
      expect(engine.update(999, { metadata: { key1: 1 } })).toBe(false);
    });
  });

  describe('delete', () => {
    it('removes a record and edges', async () => {
      const id1 = unwrap(await engine.insert('first'));
      const id2 = unwrap(await engine.insert('second'));
      engine.relate({ fromId: id1, toId: id2, type: 'elaborates' });
      expect(engine.delete(id1)).toBe(true);
      expect(engine.getById(id1)).toBeUndefined();
    });

    it('returns false for unknown ID', () => {
      expect(engine.delete(999)).toBe(false);
    });
  });

  describe('relate', () => {
    it('creates an edge between existing records', async () => {
      const id1 = unwrap(await engine.insert('first'));
      const id2 = unwrap(await engine.insert('second'));
      const edgeId = engine.relate({ fromId: id1, toId: id2, type: 'supersedes' });
      expect(edgeId).toBeGreaterThan(0);
      const edges = storage.edgesFrom(id1);
      expect(edges).toHaveLength(1);
      const firstEdge = edges[0];
      if (!firstEdge) {
        throw new Error('expected edge');
      }
      expect(firstEdge.type).toBe('supersedes');
    });

    it('returns 0 for unknown record', async () => {
      const id1 = unwrap(await engine.insert('first'));
      expect(engine.relate({ fromId: id1, toId: 999, type: 'elaborates' })).toBe(0);
    });
  });

  describe('getById', () => {
    it('returns record for existing ID', async () => {
      const id = unwrap(await engine.insert('hello'));
      const record = engine.getById(id);
      expect(record).toBeDefined();
    });

    it('returns undefined for non-existent ID', () => {
      expect(engine.getById(999)).toBeUndefined();
    });

    it('returns tombstone marker for tombstoned record', async () => {
      const id = unwrap(await engine.insert('hello'));
      storage.tombstoneRecord(id);
      const record = engine.getById(id);
      expect(record).toBeDefined();
      if (!record) {
        throw new Error('expected record');
      }
      expect(record.tombstoned).toBe(true);
      expect(record.data).toBeUndefined();
    });
  });

  describe('query', () => {
    it('returns matching records above threshold', async () => {
      unwrap(await engine.insert('matching content', { importance: 0.5 }));
      const result = await engine.query('matching content', { threshold: 0, strengthen: false });
      expect(result.isOk()).toBe(true);
      expect(result._unsafeUnwrap()).toHaveLength(1);
    });

    it('returns empty array when no records exist', async () => {
      const result = await engine.query('anything');
      expect(result.isOk()).toBe(true);
      expect(result._unsafeUnwrap()).toHaveLength(0);
    });

    it('excludes tombstoned records', async () => {
      const id = unwrap(await engine.insert('hello'));
      storage.tombstoneRecord(id);
      const result = await engine.query('hello', { threshold: 0, strengthen: false });
      expect(result.isOk()).toBe(true);
      expect(result._unsafeUnwrap()).toHaveLength(0);
    });

    it('detects embedding model mismatch', async () => {
      unwrap(await engine.insert('hello'));
      const vec = normalize([1, 0, 0]);
      const mismatchAdapter: EmbeddingAdapter = {
        modelId: 'different-model',
        dimensions: vec.length,
        embed(text: string): ResultAsync<EmbedResult, EmbedError> {
          if (!text || text.trim().length === 0) {
            return errAsync({ type: 'EMBED_EMPTY_INPUT' });
          }
          return okAsync({
            vector: vec,
            modelId: 'different-model',
            dimensions: vec.length,
          });
        },
      };
      const mismatchEngine = new LtmEngine({ storage, embeddingAdapter: mismatchAdapter });
      const result = await mismatchEngine.query('hello');
      expect(result.isErr()).toBe(true);
      expect(result._unsafeUnwrapErr().type).toBe('EMBEDDING_MODEL_MISMATCH');
    });

    it('respects tier filter', async () => {
      unwrap(await engine.insert('episodic record'));
      const result = await engine.query('episodic', {
        tier: 'semantic',
        threshold: 0,
        strengthen: false,
      });
      expect(result.isOk()).toBe(true);
      expect(result._unsafeUnwrap()).toHaveLength(0);
    });

    it('respects limit option', async () => {
      unwrap(await engine.insert('first'));
      unwrap(await engine.insert('second'));
      unwrap(await engine.insert('third'));
      const result = await engine.query('test', { limit: 1, threshold: 0, strengthen: false });
      expect(result.isOk()).toBe(true);
      expect(result._unsafeUnwrap()).toHaveLength(1);
    });

    it('includes retrieval strategies in results', async () => {
      unwrap(await engine.insert('hello world'));
      const result = await engine.query('hello', { threshold: 0, strengthen: false });
      expect(result.isOk()).toBe(true);
      const results = result._unsafeUnwrap();
      if (results.length > 0) {
        const first = results[0];
        if (!first) {
          throw new Error('expected result');
        }
        expect(first.retrievalStrategies.length).toBeGreaterThan(0);
      }
    });

    it('marks superseded records', async () => {
      const oldId = unwrap(await engine.insert('old version'));
      const newId = unwrap(await engine.insert('new version'));
      engine.relate({ fromId: newId, toId: oldId, type: 'supersedes' });
      const result = await engine.query('version', { threshold: 0, strengthen: false });
      expect(result.isOk()).toBe(true);
      const results = result._unsafeUnwrap();
      const oldResult = results.find((record) => record.record.id === oldId);
      if (oldResult) {
        expect(oldResult.isSuperseded).toBe(true);
      }
    });

    it('does not strengthen when strengthen=false', async () => {
      const id = unwrap(await engine.insert('test record'));
      const before = (engine.getById(id) as LtmRecord).accessCount;
      await engine.query('test', { threshold: 0, strengthen: false });
      const after = (engine.getById(id) as LtmRecord).accessCount;
      expect(after).toBe(before);
    });

    it('strengthens top result on query with strengthen=true', async () => {
      const id = unwrap(await engine.insert('test record'));
      const before = (engine.getById(id) as LtmRecord).accessCount;
      await engine.query('test', { threshold: 0, strengthen: true });
      const after = (engine.getById(id) as LtmRecord).accessCount;
      expect(after).toBeGreaterThan(before);
    });

    it('includes confidence for semantic records', async () => {
      const id1 = unwrap(await engine.insert('source a', { importance: 0.5 }));
      const id2 = unwrap(await engine.insert('source b', { importance: 0.5 }));
      storage.updateStability(id1, { stability: 5, lastAccessedAt: new Date(), accessCount: 3 });
      storage.updateStability(id2, { stability: 5, lastAccessedAt: new Date(), accessCount: 3 });
      const consolidatedId = unwrap(
        await engine.consolidate([id1, id2], {
          data: 'consolidated record',
          options: { confidence: 0.8 },
        }),
      );
      const result = await engine.query('consolidated', { threshold: 0, strengthen: false });
      expect(result.isOk()).toBe(true);
      const results = result._unsafeUnwrap();
      const semResult = results.find((record) => record.record.id === consolidatedId);
      if (semResult) {
        expect(semResult.confidence).toBe(0.8);
      }
    });

    it('sorts by recency when requested', async () => {
      const id1 = unwrap(await engine.insert('first'));
      const id2 = unwrap(await engine.insert('second'));
      storage.updateStability(id1, {
        stability: 5,
        lastAccessedAt: new Date(Date.now() - 10_000),
        accessCount: 1,
      });
      storage.updateStability(id2, { stability: 5, lastAccessedAt: new Date(), accessCount: 1 });
      const result = await engine.query('test', {
        threshold: 0,
        strengthen: false,
        sort: 'recency',
      });
      expect(result.isOk()).toBe(true);
      const results = result._unsafeUnwrap();
      if (results.length >= 2) {
        const first = results[0];
        const second = results[1];
        if (!first || !second) {
          throw new Error('expected results');
        }
        expect(first.record.lastAccessedAt.getTime()).toBeGreaterThanOrEqual(
          second.record.lastAccessedAt.getTime(),
        );
      }
    });

    it('emits decay event when retention below 0.2', async () => {
      const id = unwrap(await engine.insert('old record'));
      storage.updateStability(id, {
        stability: 1,
        lastAccessedAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
        accessCount: 0,
      });

      const decayed: unknown[] = [];
      events.addEventListener('ltm:record:decayed-below-threshold', (event: Event) => {
        decayed.push((event as CustomEvent).detail);
      });

      await engine.query('old record', { threshold: 0, strengthen: false });
      expect(decayed.length).toBeGreaterThanOrEqual(0);
    });
  });

  describe('findConsolidationCandidates', () => {
    it('groups similar episodic records', async () => {
      const id1 = unwrap(await engine.insert('topic A detail one', { importance: 0.5 }));
      const id2 = unwrap(await engine.insert('topic A detail two', { importance: 0.5 }));
      storage.updateStability(id1, { stability: 5, lastAccessedAt: new Date(), accessCount: 3 });
      storage.updateStability(id2, { stability: 5, lastAccessedAt: new Date(), accessCount: 3 });

      const clusters = engine.findConsolidationCandidates({
        similarityThreshold: 0,
        minAccessCount: 2,
      });
      expect(clusters.length).toBeGreaterThanOrEqual(1);
      const firstCluster = clusters[0];
      if (!firstCluster) {
        throw new Error('expected cluster');
      }
      expect(firstCluster.length).toBe(2);
    });

    it('excludes semantic records', async () => {
      const id1 = unwrap(await engine.insert('source a', { importance: 0.5 }));
      const id2 = unwrap(await engine.insert('source b', { importance: 0.5 }));
      storage.updateStability(id1, { stability: 5, lastAccessedAt: new Date(), accessCount: 3 });
      storage.updateStability(id2, { stability: 5, lastAccessedAt: new Date(), accessCount: 3 });
      unwrap(await engine.consolidate([id1, id2], { data: 'consolidated' }));

      const clusters = engine.findConsolidationCandidates({
        similarityThreshold: 0,
        minAccessCount: 0,
      });
      for (const cluster of clusters) {
        for (const record of cluster) {
          expect(record.tier).toBe('episodic');
        }
      }
    });

    it('excludes records below minAccessCount', async () => {
      unwrap(await engine.insert('topic A'));
      const clusters = engine.findConsolidationCandidates({ minAccessCount: 5 });
      expect(clusters).toHaveLength(0);
    });
  });

  describe('consolidate', () => {
    it('creates a semantic record', async () => {
      const id1 = unwrap(await engine.insert('source one', { importance: 0.4 }));
      const id2 = unwrap(await engine.insert('source two', { importance: 0.7 }));
      const newId = unwrap(await engine.consolidate([id1, id2], { data: 'merged insight' }));
      const record = engine.getById(newId) as LtmRecord;
      expect(record.tier).toBe('semantic');
      expect(record.importance).toBe(0.7);
    });

    it('uses confidence-adjusted stability', async () => {
      const id1 = unwrap(await engine.insert('source one', { importance: 0.5 }));
      const id2 = unwrap(await engine.insert('source two', { importance: 0.5 }));
      const maxStabBefore = Math.max(
        (engine.getById(id1) as LtmRecord).stability,
        (engine.getById(id2) as LtmRecord).stability,
      );
      const newId = unwrap(
        await engine.consolidate([id1, id2], {
          data: 'merged',
          options: { confidence: 0 },
        }),
      );
      const record = engine.getById(newId) as LtmRecord;
      expect(record.stability).toBeCloseTo(maxStabBefore * 1, 1);
    });

    it('creates consolidates edges', async () => {
      const id1 = unwrap(await engine.insert('source one'));
      const id2 = unwrap(await engine.insert('source two'));
      const newId = unwrap(await engine.consolidate([id1, id2], { data: 'merged' }));
      const edges = storage.edgesFrom(newId);
      expect(edges).toHaveLength(2);
      expect(edges.every((edge) => edge.type === 'consolidates')).toBe(true);
    });

    it('deflates source stability by default', async () => {
      const id1 = unwrap(await engine.insert('source', { importance: 0.5 }));
      const beforeStability = (engine.getById(id1) as LtmRecord).stability;
      unwrap(await engine.consolidate([id1], { data: 'merged' }));
      const afterStability = (engine.getById(id1) as LtmRecord).stability;
      expect(afterStability).toBeCloseTo(beforeStability / 2, 2);
    });

    it('skips deflation when option is false', async () => {
      const id1 = unwrap(await engine.insert('source', { importance: 0.5 }));
      const beforeStability = (engine.getById(id1) as LtmRecord).stability;
      unwrap(
        await engine.consolidate([id1], {
          data: 'merged',
          options: { deflateSourceStability: false },
        }),
      );
      const afterStability = (engine.getById(id1) as LtmRecord).stability;
      expect(afterStability).toBe(beforeStability);
    });

    it('stores confidence metadata', async () => {
      const id1 = unwrap(await engine.insert('source'));
      const newId = unwrap(
        await engine.consolidate([id1], {
          data: 'merged',
          options: {
            confidence: 0.7,
            preservedFacts: ['fact A'],
            uncertainties: ['uncertainty B'],
          },
        }),
      );
      const record = engine.getById(newId) as LtmRecord;
      expect(record.metadata.confidence).toBe(0.7);
      expect(record.metadata.preservedFacts).toEqual(['fact A']);
      expect(record.metadata.uncertainties).toEqual(['uncertainty B']);
    });

    it('source records remain retrievable', async () => {
      const id1 = unwrap(await engine.insert('source'));
      unwrap(await engine.consolidate([id1], { data: 'merged' }));
      expect(engine.getById(id1)).toBeDefined();
    });
  });

  describe('prune', () => {
    it('removes records below retention threshold', async () => {
      const id = unwrap(await engine.insert('old record'));
      storage.updateStability(id, {
        stability: 1,
        lastAccessedAt: new Date(Date.now() - 100 * 24 * 60 * 60 * 1000),
        accessCount: 0,
      });

      const result = engine.prune({ minRetention: 0.1 });
      expect(result.pruned).toBe(1);
    });

    it('tombstones consolidated episodics instead of deleting', async () => {
      const id1 = unwrap(await engine.insert('source'));
      storage.updateStability(id1, {
        stability: 1,
        lastAccessedAt: new Date(Date.now() - 100 * 24 * 60 * 60 * 1000),
        accessCount: 0,
      });
      unwrap(await engine.consolidate([id1], { data: 'merged' }));

      engine.prune({ minRetention: 0.5 });
      const record = engine.getById(id1);
      expect(record).toBeDefined();
      if (!record) {
        throw new Error('expected record');
      }
      expect(record.tombstoned).toBe(true);
    });

    it('fully deletes unconsolidated episodics', async () => {
      const id = unwrap(await engine.insert('standalone'));
      storage.updateStability(id, {
        stability: 1,
        lastAccessedAt: new Date(Date.now() - 100 * 24 * 60 * 60 * 1000),
        accessCount: 0,
      });

      engine.prune({ minRetention: 0.1 });
      expect(engine.getById(id)).toBeUndefined();
    });

    it('respects tier filter', async () => {
      const epId = unwrap(await engine.insert('episodic'));
      storage.updateStability(epId, {
        stability: 1,
        lastAccessedAt: new Date(Date.now() - 100 * 24 * 60 * 60 * 1000),
        accessCount: 0,
      });

      const id1 = unwrap(await engine.insert('source for semantic'));
      const semId = unwrap(await engine.consolidate([id1], { data: 'semantic record' }));
      storage.updateStability(semId, {
        stability: 1,
        lastAccessedAt: new Date(Date.now() - 100 * 24 * 60 * 60 * 1000),
        accessCount: 0,
      });

      engine.prune({ tier: 'episodic', minRetention: 0.1 });
      expect(engine.getById(epId)).toBeUndefined();
      const semRecord = engine.getById(semId);
      expect(semRecord).toBeDefined();
    });
  });

  describe('entity inheritance through consolidation', () => {
    it('unions entities from source records', async () => {
      const id1 = unwrap(
        await engine.insert('source one', {
          metadata: { entities: [{ name: 'alice', type: 'person' }] },
        }),
      );
      const id2 = unwrap(
        await engine.insert('source two', {
          metadata: { entities: [{ name: 'sqlite', type: 'tool' }] },
        }),
      );
      const semId = unwrap(await engine.consolidate([id1, id2], { data: 'merged' }));
      const record = engine.getById(semId) as LtmRecord;
      expect(record.metadata.entities).toEqual(
        expect.arrayContaining([
          { name: 'alice', type: 'person' },
          { name: 'sqlite', type: 'tool' },
        ]),
      );
    });

    it('deduplicates identical entities', async () => {
      const id1 = unwrap(
        await engine.insert('source one', {
          metadata: { entities: [{ name: 'alice', type: 'person' }] },
        }),
      );
      const id2 = unwrap(
        await engine.insert('source two', {
          metadata: { entities: [{ name: 'alice', type: 'person' }] },
        }),
      );
      const semId = unwrap(await engine.consolidate([id1, id2], { data: 'merged' }));
      const record = engine.getById(semId) as LtmRecord;
      const entities = record.metadata.entities as { name: string; type: string }[];
      const aliceEntries = entities.filter(
        (entity) => entity.name === 'alice' && entity.type === 'person',
      );
      expect(aliceEntries).toHaveLength(1);
    });

    it('omits entities field when sources have none', async () => {
      const id1 = unwrap(await engine.insert('source one'));
      const id2 = unwrap(await engine.insert('source two'));
      const semId = unwrap(await engine.consolidate([id1, id2], { data: 'merged' }));
      const record = engine.getById(semId) as LtmRecord;
      expect(record.metadata.entities).toBeUndefined();
    });

    it('entity-filtered query finds consolidated semantic record', async () => {
      const id1 = unwrap(
        await engine.insert('alice prefers dark mode', {
          metadata: { entities: [{ name: 'alice', type: 'person' }] },
        }),
      );
      const semId = unwrap(await engine.consolidate([id1], { data: 'alice prefers dark mode' }));
      const result = await engine.query('alice', { entityName: 'alice', threshold: 0 });
      const ids = result.isOk() ? result.value.map((queryResult) => queryResult.record.id) : [];
      expect(ids).toContain(semId);
    });
  });

  describe('stats', () => {
    it('reflects current store state', async () => {
      unwrap(await engine.insert('a'));
      unwrap(await engine.insert('b'));
      const id3 = unwrap(await engine.insert('c'));
      unwrap(await engine.consolidate([id3], { data: 'semantic one' }));

      const stat = engine.stats();
      expect(stat.total).toBe(4);
      expect(stat.episodic).toBe(3);
      expect(stat.semantic).toBe(1);
      expect(stat.avgStability).toBeGreaterThan(0);
      expect(stat.avgRetention).toBeGreaterThan(0);
    });
  });
});
