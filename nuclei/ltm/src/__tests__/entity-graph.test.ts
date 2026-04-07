import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import Database from 'better-sqlite3';
import * as sqliteVec from 'sqlite-vec';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { InMemoryAdapter } from '../storage/in-memory-adapter.js';
import { SqliteAdapter } from '../storage/sqlite-adapter.js';
import { runMigrations, SCHEMA } from '../storage/sqlite-schema.js';
import type { EntityNode } from '../storage/storage-adapter.js';

function makeEntity(overrides: Partial<Omit<EntityNode, 'id'>> = {}): Omit<EntityNode, 'id'> {
  return {
    name: overrides.name ?? 'alice',
    type: overrides.type ?? 'person',
    embedding: overrides.embedding ?? new Float32Array([1, 0, 0]),
    createdAt: overrides.createdAt ?? new Date(),
  };
}

describe('V3 migration (SqliteAdapter)', () => {
  let testDirectory: string;
  let dbPath: string;

  beforeEach(() => {
    testDirectory = mkdtempSync(path.join(tmpdir(), 'ltm-test-'));
    dbPath = path.join(testDirectory, 'test.db');
  });

  afterEach(() => {
    rmSync(testDirectory, { recursive: true, force: true });
  });

  it('7.1a upgrades V2 database to V3', () => {
    const db = new Database(dbPath);
    sqliteVec.load(db);
    db.exec(SCHEMA);
    db.pragma('user_version = 2');

    runMigrations(db);

    const version = db.pragma('user_version', { simple: true }) as number;
    expect(version).toBe(3);

    const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all() as {
      name: string;
    }[];
    const tableNames = tables.map((table) => table.name);
    expect(tableNames).toContain('entities');
    expect(tableNames).toContain('entity_edges');
    expect(tableNames).toContain('entity_record_links');
    db.close();
  });

  it('7.1b V3 migration is idempotent', () => {
    const db = new Database(dbPath);
    sqliteVec.load(db);
    db.exec(SCHEMA);
    runMigrations(db);
    runMigrations(db);

    const version = db.pragma('user_version', { simple: true }) as number;
    expect(version).toBe(3);
    db.close();
  });
});

describe('SqliteAdapter entity graph', () => {
  let testDirectory: string;
  let adapter: SqliteAdapter;

  beforeEach(() => {
    testDirectory = mkdtempSync(path.join(tmpdir(), 'ltm-test-'));
    adapter = new SqliteAdapter(path.join(testDirectory, 'test.db'));
  });

  afterEach(() => {
    rmSync(testDirectory, { recursive: true, force: true });
  });

  describe('insertEntity / findEntityByEmbedding', () => {
    it('7.2a inserts entity and returns id > 0', () => {
      const id = adapter.insertEntity(makeEntity());
      expect(id).toBeGreaterThan(0);
    });

    it('7.2b duplicate name inserts produce distinct ids', () => {
      const id1 = adapter.insertEntity(makeEntity({ name: 'alice' }));
      const id2 = adapter.insertEntity(makeEntity({ name: 'alice' }));
      expect(id1).not.toBe(id2);
    });

    it('7.2c returns candidates above threshold', () => {
      adapter.insertEntity(makeEntity({ name: 'alice', embedding: new Float32Array([1, 0, 0]) }));
      adapter.insertEntity(makeEntity({ name: 'bob', embedding: new Float32Array([0, 1, 0]) }));

      const results = adapter.findEntityByEmbedding(new Float32Array([1, 0, 0]), 0.9);
      expect(results).toHaveLength(1);
      expect(results[0]?.name).toBe('alice');
    });

    it('7.2d returns empty array when no candidates exceed threshold', () => {
      adapter.insertEntity(makeEntity({ name: 'alice', embedding: new Float32Array([1, 0, 0]) }));

      const results = adapter.findEntityByEmbedding(new Float32Array([0, 1, 0]), 0.95);
      expect(results).toHaveLength(0);
    });

    it('7.2e results ordered by similarity descending', () => {
      const embeddingA = new Float32Array([1, 0, 0]);
      const embeddingB = new Float32Array([0.8, 0.6, 0]);
      const embeddingC = new Float32Array([0.6, 0.8, 0]);
      adapter.insertEntity(makeEntity({ name: 'alice', embedding: embeddingA }));
      adapter.insertEntity(makeEntity({ name: 'bob', embedding: embeddingB }));
      adapter.insertEntity(makeEntity({ name: 'charlie', embedding: embeddingC }));

      const query = new Float32Array([1, 0, 0]);
      const results = adapter.findEntityByEmbedding(query, 0.5);
      expect(results.map((entity) => entity.name)).toEqual(['alice', 'bob', 'charlie']);
    });
  });

  describe('insertEntityEdge / getEntityNeighbors', () => {
    it('7.3a edge inserted is reflected in getEntityNeighbors depth 1', () => {
      const aliceId = adapter.insertEntity(makeEntity({ name: 'alice' }));
      const bobId = adapter.insertEntity(makeEntity({ name: 'bob' }));

      adapter.insertEntityEdge({
        fromId: aliceId,
        toId: bobId,
        type: 'prefers',
        createdAt: new Date(),
      });

      const neighbors = adapter.getEntityNeighbors(aliceId, 1);
      expect(neighbors.map((node) => node.id)).toContain(bobId);
    });

    it('7.3b direct neighbors at depth 1 does not include 2-hop', () => {
      const aliceId = adapter.insertEntity(makeEntity({ name: 'alice' }));
      const bobId = adapter.insertEntity(makeEntity({ name: 'bob' }));
      const danId = adapter.insertEntity(makeEntity({ name: 'dan' }));

      adapter.insertEntityEdge({
        fromId: aliceId,
        toId: bobId,
        type: 'knows',
        createdAt: new Date(),
      });
      adapter.insertEntityEdge({
        fromId: bobId,
        toId: danId,
        type: 'knows',
        createdAt: new Date(),
      });

      const neighbors = adapter.getEntityNeighbors(aliceId, 1);
      const ids = neighbors.map((node) => node.id);
      expect(ids).toContain(bobId);
      expect(ids).not.toContain(danId);
    });

    it('7.3c two-hop neighbors returned at depth 2', () => {
      const aliceId = adapter.insertEntity(makeEntity({ name: 'alice' }));
      const bobId = adapter.insertEntity(makeEntity({ name: 'bob' }));
      const danId = adapter.insertEntity(makeEntity({ name: 'dan' }));

      adapter.insertEntityEdge({
        fromId: aliceId,
        toId: bobId,
        type: 'knows',
        createdAt: new Date(),
      });
      adapter.insertEntityEdge({
        fromId: bobId,
        toId: danId,
        type: 'knows',
        createdAt: new Date(),
      });

      const neighbors = adapter.getEntityNeighbors(aliceId, 2);
      const ids = neighbors.map((node) => node.id);
      expect(ids).toContain(bobId);
      expect(ids).toContain(danId);
    });

    it('7.3d depth clamped to 5 when value exceeds max', () => {
      const aliceId = adapter.insertEntity(makeEntity({ name: 'alice' }));
      const bobId = adapter.insertEntity(makeEntity({ name: 'bob' }));
      adapter.insertEntityEdge({
        fromId: aliceId,
        toId: bobId,
        type: 'knows',
        createdAt: new Date(),
      });

      expect(() => adapter.getEntityNeighbors(aliceId, 10)).not.toThrow();
      const neighbors = adapter.getEntityNeighbors(aliceId, 10);
      expect(neighbors.map((node) => node.id)).toContain(bobId);
    });

    it('7.3e no neighbors returns empty array', () => {
      const aliceId = adapter.insertEntity(makeEntity({ name: 'alice' }));
      const neighbors = adapter.getEntityNeighbors(aliceId, 1);
      expect(neighbors).toHaveLength(0);
    });
  });
});

describe('InMemoryAdapter entity graph', () => {
  let adapter: InMemoryAdapter;

  beforeEach(() => {
    adapter = new InMemoryAdapter();
  });

  it('7.4a insertEntity returns id > 0', () => {
    const id = adapter.insertEntity(makeEntity());
    expect(id).toBeGreaterThan(0);
  });

  it('7.4b duplicate name inserts produce distinct ids', () => {
    const id1 = adapter.insertEntity(makeEntity({ name: 'alice' }));
    const id2 = adapter.insertEntity(makeEntity({ name: 'alice' }));
    expect(id1).not.toBe(id2);
  });

  it('7.4c findEntityByEmbedding returns candidates above threshold', () => {
    adapter.insertEntity(makeEntity({ name: 'alice', embedding: new Float32Array([1, 0, 0]) }));
    adapter.insertEntity(makeEntity({ name: 'bob', embedding: new Float32Array([0, 1, 0]) }));

    const results = adapter.findEntityByEmbedding(new Float32Array([1, 0, 0]), 0.9);
    expect(results).toHaveLength(1);
    expect(results[0]?.name).toBe('alice');
  });

  it('7.4d findEntityByEmbedding returns empty when no candidates exceed threshold', () => {
    adapter.insertEntity(makeEntity({ name: 'alice', embedding: new Float32Array([1, 0, 0]) }));
    const results = adapter.findEntityByEmbedding(new Float32Array([0, 1, 0]), 0.95);
    expect(results).toHaveLength(0);
  });

  it('7.4e getEntityNeighbors depth 1 returns direct neighbors only', () => {
    const aliceId = adapter.insertEntity(makeEntity({ name: 'alice' }));
    const bobId = adapter.insertEntity(makeEntity({ name: 'bob' }));
    const danId = adapter.insertEntity(makeEntity({ name: 'dan' }));

    adapter.insertEntityEdge({
      fromId: aliceId,
      toId: bobId,
      type: 'knows',
      createdAt: new Date(),
    });
    adapter.insertEntityEdge({ fromId: bobId, toId: danId, type: 'knows', createdAt: new Date() });

    const neighbors = adapter.getEntityNeighbors(aliceId, 1);
    const ids = neighbors.map((node) => node.id);
    expect(ids).toContain(bobId);
    expect(ids).not.toContain(danId);
  });

  it('7.4f getEntityNeighbors depth 2 returns 2-hop neighbors', () => {
    const aliceId = adapter.insertEntity(makeEntity({ name: 'alice' }));
    const bobId = adapter.insertEntity(makeEntity({ name: 'bob' }));
    const danId = adapter.insertEntity(makeEntity({ name: 'dan' }));

    adapter.insertEntityEdge({
      fromId: aliceId,
      toId: bobId,
      type: 'knows',
      createdAt: new Date(),
    });
    adapter.insertEntityEdge({ fromId: bobId, toId: danId, type: 'knows', createdAt: new Date() });

    const neighbors = adapter.getEntityNeighbors(aliceId, 2);
    const ids = neighbors.map((node) => node.id);
    expect(ids).toContain(bobId);
    expect(ids).toContain(danId);
  });

  it('7.4g getEntityNeighbors depth clamped to 5', () => {
    const aliceId = adapter.insertEntity(makeEntity({ name: 'alice' }));
    const bobId = adapter.insertEntity(makeEntity({ name: 'bob' }));
    adapter.insertEntityEdge({
      fromId: aliceId,
      toId: bobId,
      type: 'knows',
      createdAt: new Date(),
    });

    expect(() => adapter.getEntityNeighbors(aliceId, 10)).not.toThrow();
  });

  it('7.4h getEntityNeighbors no neighbors returns empty array', () => {
    const aliceId = adapter.insertEntity(makeEntity({ name: 'alice' }));
    expect(adapter.getEntityNeighbors(aliceId, 1)).toHaveLength(0);
  });
});
