import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import Database from 'better-sqlite3';
import * as sqliteVec from 'sqlite-vec';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { InMemoryAdapter } from '../storage/in-memory-adapter.js';
import { SqliteAdapter } from '../storage/sqlite-adapter.js';
import { runMigrations, SCHEMA } from '../storage/sqlite-schema.js';
import type { EntityNode, EntityPathStep } from '../storage/storage-adapter.js';

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

  it('7.1a upgrades V2 database to V4', () => {
    const db = new Database(dbPath);
    sqliteVec.load(db);
    db.exec(SCHEMA);
    db.pragma('user_version = 2');

    runMigrations(db);

    const version = db.pragma('user_version', { simple: true }) as number;
    expect(version).toBe(4);

    const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all() as {
      name: string;
    }[];
    const tableNames = tables.map((table) => table.name);
    expect(tableNames).toContain('entities');
    expect(tableNames).toContain('entity_edges');
    expect(tableNames).toContain('entity_record_links');
    db.close();
  });

  it('7.1b migrations are idempotent', () => {
    const db = new Database(dbPath);
    sqliteVec.load(db);
    db.exec(SCHEMA);
    runMigrations(db);
    runMigrations(db);

    const version = db.pragma('user_version', { simple: true }) as number;
    expect(version).toBe(4);
    db.close();
  });

  it('8.2a upgrades V3 database to V4 — weight column added to entity_edges', () => {
    const db = new Database(dbPath);
    sqliteVec.load(db);
    db.exec(SCHEMA);
    db.pragma('user_version = 2');
    db.transaction(() => {
      db.prepare(
        'CREATE TABLE IF NOT EXISTS entities (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, type TEXT NOT NULL, embedding BLOB NOT NULL, created_at INTEGER NOT NULL)',
      ).run();
      db.prepare(
        'CREATE TABLE IF NOT EXISTS entity_edges (id INTEGER PRIMARY KEY AUTOINCREMENT, from_id INTEGER NOT NULL, to_id INTEGER NOT NULL, type TEXT NOT NULL, created_at INTEGER NOT NULL)',
      ).run();
      db.prepare(
        'CREATE TABLE IF NOT EXISTS entity_record_links (id INTEGER PRIMARY KEY AUTOINCREMENT, entity_id INTEGER NOT NULL, record_id INTEGER NOT NULL, created_at INTEGER NOT NULL)',
      ).run();
      db.pragma('user_version = 3');
    })();

    runMigrations(db);

    const version = db.pragma('user_version', { simple: true }) as number;
    expect(version).toBe(4);

    const columns = db.prepare('PRAGMA table_info(entity_edges)').all() as {
      name: string;
      dflt_value: string | null;
    }[];
    const weightCol = columns.find((col) => col.name === 'weight');
    expect(weightCol).toBeDefined();
    expect(weightCol?.dflt_value).toBe('1.0');
    db.close();
  });

  it('8.2b V4 migration is idempotent', () => {
    new SqliteAdapter(dbPath);
    const db = new Database(dbPath);
    sqliteVec.load(db);

    expect(() => {
      runMigrations(db);
    }).not.toThrow();

    const version = db.pragma('user_version', { simple: true }) as number;
    expect(version).toBe(4);
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

    it('7.3f duplicate edge insert is a no-op — one row exists', () => {
      const aliceId = adapter.insertEntity(makeEntity({ name: 'alice' }));
      const bobId = adapter.insertEntity(makeEntity({ name: 'bob' }));
      const edge = { fromId: aliceId, toId: bobId, type: 'prefers', createdAt: new Date() };

      adapter.insertEntityEdge(edge);
      adapter.insertEntityEdge(edge);

      const neighbors = adapter.getEntityNeighbors(aliceId, 1);
      expect(neighbors).toHaveLength(1);
    });

    it('7.3g same node pair with different type creates two edges', () => {
      const aliceId = adapter.insertEntity(makeEntity({ name: 'alice' }));
      const bobId = adapter.insertEntity(makeEntity({ name: 'bob' }));

      adapter.insertEntityEdge({
        fromId: aliceId,
        toId: bobId,
        type: 'prefers',
        createdAt: new Date(),
      });
      adapter.insertEntityEdge({
        fromId: aliceId,
        toId: bobId,
        type: 'works_with',
        createdAt: new Date(),
      });

      const neighbors = adapter.getEntityNeighbors(aliceId, 1);
      expect(neighbors).toHaveLength(1);
    });

    it('8.3a edge inserted without weight defaults to 1.0', () => {
      const aId = adapter.insertEntity(makeEntity({ name: 'a' }));
      const bId = adapter.insertEntity(makeEntity({ name: 'b' }));
      adapter.insertEntityEdge({ fromId: aId, toId: bId, type: 'link', createdAt: new Date() });

      const path = adapter.findEntityPath({ fromId: aId, toId: bId });
      expect(path).toHaveLength(2);
      expect(path[1]?.via?.weight).toBe(1);
    });

    it('8.3b edge inserted with explicit weight stores the provided value', () => {
      const aId = adapter.insertEntity(makeEntity({ name: 'a' }));
      const bId = adapter.insertEntity(makeEntity({ name: 'b' }));
      adapter.insertEntityEdge({
        fromId: aId,
        toId: bId,
        type: 'link',
        weight: 3,
        createdAt: new Date(),
      });

      const path = adapter.findEntityPath({ fromId: aId, toId: bId });
      expect(path).toHaveLength(2);
      expect(path[1]?.via?.weight).toBe(3);
    });
  });

  describe('findEntityPath', () => {
    it('8.1a direct path of one hop', () => {
      const aId = adapter.insertEntity(makeEntity({ name: 'a' }));
      const bId = adapter.insertEntity(makeEntity({ name: 'b' }));
      adapter.insertEntityEdge({
        fromId: aId,
        toId: bId,
        type: 'navigates_to',
        createdAt: new Date(),
      });

      const path = adapter.findEntityPath({ fromId: aId, toId: bId });
      expect(path).toHaveLength(2);
      expect(path[0]?.entity.id).toBe(aId);
      expect(path[0]?.via).toBeUndefined();
      expect(path[1]?.entity.id).toBe(bId);
      expect(path[1]?.via?.type).toBe('navigates_to');
    });

    it('8.1b multi-hop path returned in order', () => {
      const aId = adapter.insertEntity(makeEntity({ name: 'a' }));
      const bId = adapter.insertEntity(makeEntity({ name: 'b' }));
      const cId = adapter.insertEntity(makeEntity({ name: 'c' }));
      adapter.insertEntityEdge({ fromId: aId, toId: bId, type: 'e1', createdAt: new Date() });
      adapter.insertEntityEdge({ fromId: bId, toId: cId, type: 'e2', createdAt: new Date() });

      const path = adapter.findEntityPath({ fromId: aId, toId: cId });
      expect(path).toHaveLength(3);
      expect(path.map((step: EntityPathStep) => step.entity.id)).toEqual([aId, bId, cId]);
      expect(path[0]?.via).toBeUndefined();
      expect(path[1]?.via?.type).toBe('e1');
      expect(path[2]?.via?.type).toBe('e2');
    });

    it('8.1c shortest path chosen when multiple paths exist', () => {
      const aId = adapter.insertEntity(makeEntity({ name: 'a' }));
      const bId = adapter.insertEntity(makeEntity({ name: 'b' }));
      const cId = adapter.insertEntity(makeEntity({ name: 'c' }));
      const dId = adapter.insertEntity(makeEntity({ name: 'd' }));
      const altId = adapter.insertEntity(makeEntity({ name: 'alt' }));
      adapter.insertEntityEdge({ fromId: aId, toId: bId, type: 'x', createdAt: new Date() });
      adapter.insertEntityEdge({ fromId: bId, toId: cId, type: 'x', createdAt: new Date() });
      adapter.insertEntityEdge({ fromId: aId, toId: dId, type: 'x', createdAt: new Date() });
      adapter.insertEntityEdge({ fromId: dId, toId: altId, type: 'x', createdAt: new Date() });
      adapter.insertEntityEdge({ fromId: altId, toId: cId, type: 'x', createdAt: new Date() });

      const path = adapter.findEntityPath({ fromId: aId, toId: cId });
      expect(path).toHaveLength(3);
      expect(path.map((step: EntityPathStep) => step.entity.id)).toEqual([aId, bId, cId]);
    });

    it('8.1d no path returns empty array', () => {
      const aId = adapter.insertEntity(makeEntity({ name: 'a' }));
      const bId = adapter.insertEntity(makeEntity({ name: 'b' }));

      expect(adapter.findEntityPath({ fromId: aId, toId: bId })).toEqual([]);
    });

    it('8.1e fromId equals toId returns single-step array', () => {
      const aId = adapter.insertEntity(makeEntity({ name: 'a' }));

      const path = adapter.findEntityPath({ fromId: aId, toId: aId });
      expect(path).toHaveLength(1);
      expect(path[0]?.entity.id).toBe(aId);
      expect(path[0]?.via).toBeUndefined();
    });

    it('8.1f maxHops exceeded returns empty array', () => {
      const nodeIds = Array.from({ length: 9 }, (_value, index) =>
        adapter.insertEntity(makeEntity({ name: `node-${String(index)}` })),
      );
      for (let index = 0; index < nodeIds.length - 1; index++) {
        const fromId = nodeIds[index];
        const toId = nodeIds[index + 1];
        if (fromId !== undefined && toId !== undefined) {
          adapter.insertEntityEdge({ fromId, toId, type: 'x', createdAt: new Date() });
        }
      }
      const firstId = nodeIds[0];
      const lastId = nodeIds.at(-1);
      expect(firstId).toBeDefined();
      expect(lastId).toBeDefined();
      if (firstId !== undefined && lastId !== undefined) {
        expect(adapter.findEntityPath({ fromId: firstId, toId: lastId, maxHops: 5 })).toEqual([]);
      }
    });

    it('8.1g cycle safety — traversal terminates', () => {
      const aId = adapter.insertEntity(makeEntity({ name: 'a' }));
      const bId = adapter.insertEntity(makeEntity({ name: 'b' }));
      const cId = adapter.insertEntity(makeEntity({ name: 'c' }));
      adapter.insertEntityEdge({ fromId: aId, toId: bId, type: 'x', createdAt: new Date() });
      adapter.insertEntityEdge({ fromId: bId, toId: aId, type: 'x', createdAt: new Date() });

      expect(adapter.findEntityPath({ fromId: aId, toId: cId })).toEqual([]);
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

  it('7.4i duplicate edge insert is a no-op — one neighbor entry', () => {
    const aliceId = adapter.insertEntity(makeEntity({ name: 'alice' }));
    const bobId = adapter.insertEntity(makeEntity({ name: 'bob' }));
    const edge = { fromId: aliceId, toId: bobId, type: 'prefers', createdAt: new Date() };

    adapter.insertEntityEdge(edge);
    adapter.insertEntityEdge(edge);

    expect(adapter.getEntityNeighbors(aliceId, 1)).toHaveLength(1);
  });

  it('7.4j same node pair with different types produces two edges', () => {
    const aliceId = adapter.insertEntity(makeEntity({ name: 'alice' }));
    const bobId = adapter.insertEntity(makeEntity({ name: 'bob' }));

    adapter.insertEntityEdge({
      fromId: aliceId,
      toId: bobId,
      type: 'prefers',
      createdAt: new Date(),
    });
    adapter.insertEntityEdge({
      fromId: aliceId,
      toId: bobId,
      type: 'works_with',
      createdAt: new Date(),
    });

    expect(adapter.getEntityNeighbors(aliceId, 1)).toHaveLength(1);
  });

  it('8.3c insertEntityEdge without weight defaults to 1.0', () => {
    const aId = adapter.insertEntity(makeEntity({ name: 'a' }));
    const bId = adapter.insertEntity(makeEntity({ name: 'b' }));
    adapter.insertEntityEdge({ fromId: aId, toId: bId, type: 'link', createdAt: new Date() });

    const path = adapter.findEntityPath({ fromId: aId, toId: bId });
    expect(path[1]?.via?.weight).toBe(1);
  });

  it('8.3d insertEntityEdge with explicit weight stores it', () => {
    const aId = adapter.insertEntity(makeEntity({ name: 'a' }));
    const bId = adapter.insertEntity(makeEntity({ name: 'b' }));
    adapter.insertEntityEdge({
      fromId: aId,
      toId: bId,
      type: 'link',
      weight: 5,
      createdAt: new Date(),
    });

    const path = adapter.findEntityPath({ fromId: aId, toId: bId });
    expect(path[1]?.via?.weight).toBe(5);
  });

  describe('findEntityPath', () => {
    it('8.1h direct path', () => {
      const aId = adapter.insertEntity(makeEntity({ name: 'a' }));
      const bId = adapter.insertEntity(makeEntity({ name: 'b' }));
      adapter.insertEntityEdge({
        fromId: aId,
        toId: bId,
        type: 'navigates_to',
        createdAt: new Date(),
      });

      const path = adapter.findEntityPath({ fromId: aId, toId: bId });
      expect(path).toHaveLength(2);
      expect(path[0]?.via).toBeUndefined();
      expect(path[1]?.via?.type).toBe('navigates_to');
    });

    it('8.1i multi-hop path in order', () => {
      const aId = adapter.insertEntity(makeEntity({ name: 'a' }));
      const bId = adapter.insertEntity(makeEntity({ name: 'b' }));
      const cId = adapter.insertEntity(makeEntity({ name: 'c' }));
      adapter.insertEntityEdge({ fromId: aId, toId: bId, type: 'e1', createdAt: new Date() });
      adapter.insertEntityEdge({ fromId: bId, toId: cId, type: 'e2', createdAt: new Date() });

      const path = adapter.findEntityPath({ fromId: aId, toId: cId });
      expect(path.map((step: EntityPathStep) => step.entity.id)).toEqual([aId, bId, cId]);
    });

    it('8.1j no path returns empty array', () => {
      const aId = adapter.insertEntity(makeEntity({ name: 'a' }));
      const bId = adapter.insertEntity(makeEntity({ name: 'b' }));
      expect(adapter.findEntityPath({ fromId: aId, toId: bId })).toEqual([]);
    });

    it('8.1k fromId equals toId returns single-step array', () => {
      const aId = adapter.insertEntity(makeEntity({ name: 'a' }));
      const path = adapter.findEntityPath({ fromId: aId, toId: aId });
      expect(path).toHaveLength(1);
      expect(path[0]?.via).toBeUndefined();
    });

    it('8.1l maxHops exceeded returns empty array', () => {
      const nodeIds = Array.from({ length: 9 }, (_value, index) =>
        adapter.insertEntity(makeEntity({ name: `node-${String(index)}` })),
      );
      for (let index = 0; index < nodeIds.length - 1; index++) {
        const fromId = nodeIds[index];
        const toId = nodeIds[index + 1];
        if (fromId !== undefined && toId !== undefined) {
          adapter.insertEntityEdge({ fromId, toId, type: 'x', createdAt: new Date() });
        }
      }
      const firstId = nodeIds[0];
      const lastId = nodeIds.at(-1);
      expect(firstId).toBeDefined();
      expect(lastId).toBeDefined();
      if (firstId !== undefined && lastId !== undefined) {
        expect(adapter.findEntityPath({ fromId: firstId, toId: lastId, maxHops: 5 })).toEqual([]);
      }
    });

    it('8.1m cycle safety — terminates without infinite loop', () => {
      const aId = adapter.insertEntity(makeEntity({ name: 'a' }));
      const bId = adapter.insertEntity(makeEntity({ name: 'b' }));
      const cId = adapter.insertEntity(makeEntity({ name: 'c' }));
      adapter.insertEntityEdge({ fromId: aId, toId: bId, type: 'x', createdAt: new Date() });
      adapter.insertEntityEdge({ fromId: bId, toId: aId, type: 'x', createdAt: new Date() });
      expect(adapter.findEntityPath({ fromId: aId, toId: cId })).toEqual([]);
    });
  });
});
