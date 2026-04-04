import { beforeEach, describe, expect, it } from 'vitest';

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
  };
}

describe('InMemoryAdapter', () => {
  let adapter: InMemoryAdapter;

  beforeEach(() => {
    adapter = new InMemoryAdapter();
  });

  describe('records', () => {
    it('inserts and retrieves a record', () => {
      const id = adapter.insertRecord(makeRecord({ data: 'hello' }));
      expect(id).toBeGreaterThan(0);
      const record = adapter.getById(id);
      expect(record).toBeDefined();
      expect((record as LtmRecord).data).toBe('hello');
    });

    it('returns monotonically increasing IDs', () => {
      const id1 = adapter.insertRecord(makeRecord());
      const id2 = adapter.insertRecord(makeRecord());
      expect(id2).toBeGreaterThan(id1);
    });

    it('bulk inserts records', () => {
      const ids = adapter.bulkInsertRecords([makeRecord({ data: 'a' }), makeRecord({ data: 'b' })]);
      expect(ids).toHaveLength(2);
      const firstId = ids[0];
      const secondId = ids[1];
      if (!firstId || !secondId) {
        throw new Error('expected ids');
      }
      expect((adapter.getById(firstId) as LtmRecord).data).toBe('a');
      expect((adapter.getById(secondId) as LtmRecord).data).toBe('b');
    });

    it('returns undefined for unknown ID', () => {
      expect(adapter.getById(999)).toBeUndefined();
    });

    it('getAllRecords excludes tombstoned', () => {
      const id1 = adapter.insertRecord(makeRecord({ data: 'live' }));
      const id2 = adapter.insertRecord(makeRecord({ data: 'dead' }));
      adapter.tombstoneRecord(id2);
      const all = adapter.getAllRecords();
      expect(all).toHaveLength(1);
      const first = all[0];
      if (!first) {
        throw new Error('expected record');
      }
      expect(first.id).toBe(id1);
    });

    it('updates metadata', () => {
      const id = adapter.insertRecord(makeRecord({ metadata: { key1: 1 } }));
      const success = adapter.updateMetadata(id, { key2: 2 });
      expect(success).toBe(true);
      const record = adapter.getById(id) as LtmRecord;
      expect(record.metadata).toEqual({ key1: 1, key2: 2 });
    });

    it('updateMetadata returns false for unknown ID', () => {
      expect(adapter.updateMetadata(999, { key1: 1 })).toBe(false);
    });

    it('updates embedding', () => {
      const id = adapter.insertRecord(makeRecord());
      const newVec = new Float32Array([4, 5, 6]);
      adapter.updateEmbedding(id, {
        embedding: newVec,
        meta: { modelId: 'new-model', dimensions: 3 },
      });
      const record = adapter.getById(id) as LtmRecord;
      expect(record.embedding).toEqual(newVec);
      expect(record.embeddingMeta.modelId).toBe('new-model');
    });

    it('updates stability', () => {
      const id = adapter.insertRecord(makeRecord());
      const now = new Date();
      adapter.updateStability(id, { stability: 42, lastAccessedAt: now, accessCount: 5 });
      const record = adapter.getById(id) as LtmRecord;
      expect(record.stability).toBe(42);
      expect(record.accessCount).toBe(5);
    });

    it('tombstones a record', () => {
      const id = adapter.insertRecord(makeRecord());
      adapter.tombstoneRecord(id);
      const result = adapter.getById(id);
      expect(result).toBeDefined();
      if (!result) {
        throw new Error('expected result');
      }
      expect(result.tombstoned).toBe(true);
      expect(result.data).toBeUndefined();
    });

    it('deletes a record and its edges', () => {
      const id1 = adapter.insertRecord(makeRecord());
      const id2 = adapter.insertRecord(makeRecord());
      adapter.insertEdge({
        fromId: id1,
        toId: id2,
        type: 'elaborates',
        stability: 5,
        lastAccessedAt: new Date(),
        createdAt: new Date(),
      });
      const deleted = adapter.deleteRecord(id1);
      expect(deleted).toBe(true);
      expect(adapter.getById(id1)).toBeUndefined();
      expect(adapter.edgesFrom(id1)).toHaveLength(0);
    });

    it('delete returns false for unknown ID', () => {
      expect(adapter.deleteRecord(999)).toBe(false);
    });
  });

  describe('edges', () => {
    it('inserts and retrieves edges', () => {
      const id1 = adapter.insertRecord(makeRecord());
      const id2 = adapter.insertRecord(makeRecord());
      const edgeId = adapter.insertEdge({
        fromId: id1,
        toId: id2,
        type: 'supersedes',
        stability: 5,
        lastAccessedAt: new Date(),
        createdAt: new Date(),
      });
      expect(edgeId).toBeGreaterThan(0);
      const edge = adapter.getEdge(edgeId);
      expect(edge).toBeDefined();
      if (!edge) {
        throw new Error('expected edge');
      }
      expect(edge.fromId).toBe(id1);
      expect(edge.toId).toBe(id2);
      expect(edge.type).toBe('supersedes');
    });

    it('edgesFrom returns correct edges', () => {
      const id1 = adapter.insertRecord(makeRecord());
      const id2 = adapter.insertRecord(makeRecord());
      adapter.insertEdge({
        fromId: id1,
        toId: id2,
        type: 'elaborates',
        stability: 5,
        lastAccessedAt: new Date(),
        createdAt: new Date(),
      });
      expect(adapter.edgesFrom(id1)).toHaveLength(1);
      expect(adapter.edgesFrom(id2)).toHaveLength(0);
    });

    it('edgesTo returns correct edges', () => {
      const id1 = adapter.insertRecord(makeRecord());
      const id2 = adapter.insertRecord(makeRecord());
      adapter.insertEdge({
        fromId: id1,
        toId: id2,
        type: 'elaborates',
        stability: 5,
        lastAccessedAt: new Date(),
        createdAt: new Date(),
      });
      expect(adapter.edgesTo(id2)).toHaveLength(1);
      expect(adapter.edgesTo(id1)).toHaveLength(0);
    });

    it('deleteEdgesFor removes all edges involving a record', () => {
      const id1 = adapter.insertRecord(makeRecord());
      const id2 = adapter.insertRecord(makeRecord());
      const id3 = adapter.insertRecord(makeRecord());
      adapter.insertEdge({
        fromId: id1,
        toId: id2,
        type: 'elaborates',
        stability: 5,
        lastAccessedAt: new Date(),
        createdAt: new Date(),
      });
      adapter.insertEdge({
        fromId: id3,
        toId: id1,
        type: 'supersedes',
        stability: 5,
        lastAccessedAt: new Date(),
        createdAt: new Date(),
      });
      adapter.deleteEdgesFor(id1);
      expect(adapter.edgesFrom(id1)).toHaveLength(0);
      expect(adapter.edgesTo(id1)).toHaveLength(0);
    });

    it('updates edge stability', () => {
      const id1 = adapter.insertRecord(makeRecord());
      const id2 = adapter.insertRecord(makeRecord());
      const edgeId = adapter.insertEdge({
        fromId: id1,
        toId: id2,
        type: 'elaborates',
        stability: 5,
        lastAccessedAt: new Date(),
        createdAt: new Date(),
      });
      const now = new Date();
      adapter.updateEdgeStability(edgeId, { stability: 42, lastAccessedAt: now });
      const edge = adapter.getEdge(edgeId);
      if (!edge) {
        throw new Error('expected edge');
      }
      expect(edge.stability).toBe(42);
    });

    it('getEdge returns undefined for unknown ID', () => {
      expect(adapter.getEdge(999)).toBeUndefined();
    });
  });

  describe('locks', () => {
    it('acquireLock always returns true', () => {
      expect(adapter.acquireLock('test', 1000)).toBe(true);
    });

    it('releaseLock does not throw', () => {
      expect(() => {
        adapter.releaseLock('test');
      }).not.toThrow();
    });
  });
});
