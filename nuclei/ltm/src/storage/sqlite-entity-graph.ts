import type Database from 'better-sqlite3';

import { MAX_ENTITY_NEIGHBOR_DEPTH, rowToEntityNode } from './sqlite-schema.js';
import type {
  EntityEdge,
  EntityNode,
  EntityPathStep,
  FindEntityPathParams,
} from './storage-adapter.js';

const MAX_PATH_HOPS = 20;
const DEFAULT_MAX_HOPS = 10;

interface EdgeEntry {
  toId: number;
  edgeId: number;
  type: string;
  weight: number;
}

interface ParentEntry {
  fromId: number;
  edgeId: number;
  type: string;
  weight: number;
}

interface BfsSearch {
  fromId: number;
  toId: number;
  maxHops: number;
}

interface PathBuild {
  fromId: number;
  toId: number;
  parent: Map<number, ParentEntry>;
}

export class SqliteEntityGraph {
  private adjacencyCache: Map<number, EdgeEntry[]> | undefined;

  constructor(private db: Database.Database) {}

  insertEntity(entity: Omit<EntityNode, 'id'>): number {
    const embeddingBuf = Buffer.from(
      entity.embedding.buffer,
      entity.embedding.byteOffset,
      entity.embedding.byteLength,
    );
    const result = this.db
      .prepare('INSERT INTO entities (name, type, embedding, created_at) VALUES (?, ?, ?, ?)')
      .run(entity.name, entity.type, embeddingBuf, entity.createdAt.getTime());
    return result.lastInsertRowid as number;
  }

  findEntityByEmbedding(embedding: Float32Array, threshold: number): EntityNode[] {
    const queryBuf = Buffer.from(embedding.buffer, embedding.byteOffset, embedding.byteLength);
    const rows = this.db
      .prepare(
        `WITH candidates AS (
          SELECT id, name, type, embedding, created_at,
                 (1.0 - vec_distance_cosine(embedding, ?)) as similarity
          FROM entities
        )
        SELECT id, name, type, embedding, created_at
        FROM candidates
        WHERE similarity >= ?
        ORDER BY similarity DESC`,
      )
      .all(queryBuf, threshold) as Record<string, unknown>[];
    return rows.map((row) => rowToEntityNode(row));
  }

  insertEntityEdge(edge: Omit<EntityEdge, 'id' | 'weight'> & { weight?: number }): number {
    const weight = edge.weight ?? 1;
    const result = this.db
      .prepare(
        'INSERT OR IGNORE INTO entity_edges (from_id, to_id, type, weight, created_at) VALUES (?, ?, ?, ?, ?)',
      )
      .run(edge.fromId, edge.toId, edge.type, weight, edge.createdAt.getTime());
    this.adjacencyCache = undefined;
    return result.lastInsertRowid as number;
  }

  getEntityNeighbors(entityId: number, depth: number): EntityNode[] {
    const clampedDepth = Math.min(Math.max(depth, 1), MAX_ENTITY_NEIGHBOR_DEPTH);
    const rows = this.db
      .prepare(
        `WITH RECURSIVE neighbors(id, depth) AS (
          SELECT to_id, 1 FROM entity_edges WHERE from_id = ?
          UNION ALL
          SELECT ee.to_id, n.depth + 1
          FROM entity_edges ee
          JOIN neighbors n ON ee.from_id = n.id
          WHERE n.depth < ?
        )
        SELECT DISTINCT e.id, e.name, e.type, e.embedding, e.created_at
        FROM entities e
        JOIN neighbors n ON e.id = n.id
        WHERE e.id != ?`,
      )
      .all(entityId, clampedDepth, entityId) as Record<string, unknown>[];
    return rows.map((row) => rowToEntityNode(row));
  }

  insertEntityRecordLink(entityId: number, recordId: number): number {
    const result = this.db
      .prepare(
        'INSERT INTO entity_record_links (entity_id, record_id, created_at) VALUES (?, ?, ?)',
      )
      .run(entityId, recordId, Date.now());
    return result.lastInsertRowid as number;
  }

  getEntitiesForRecord(recordId: number): EntityNode[] {
    return (
      this.db
        .prepare(
          `SELECT e.id, e.name, e.type, e.embedding, e.created_at
           FROM entities e JOIN entity_record_links erl ON e.id = erl.entity_id
           WHERE erl.record_id = ?`,
        )
        .all(recordId) as Record<string, unknown>[]
    ).map((row) => rowToEntityNode(row));
  }

  getUnlinkedRecordIds(): number[] {
    const rows = this.db
      .prepare(
        `SELECT r.id FROM records r
         WHERE r.tombstoned = 0
         AND r.id NOT IN (SELECT DISTINCT record_id FROM entity_record_links)`,
      )
      .all() as { id: number }[];
    return rows.map((row) => row.id);
  }

  findEntityPath({
    fromId,
    toId,
    maxHops = DEFAULT_MAX_HOPS,
  }: FindEntityPathParams): EntityPathStep[] {
    const clampedMaxHops = Math.min(Math.max(maxHops, 1), MAX_PATH_HOPS);

    if (fromId === toId) {
      return this.singleNodePath(fromId);
    }

    const parent = this.runBfs({ fromId, toId, maxHops: clampedMaxHops });
    if (!parent) {
      return [];
    }

    return this.buildPath({ fromId, toId, parent });
  }

  private singleNodePath(entityId: number): EntityPathStep[] {
    const row = this.db.prepare('SELECT * FROM entities WHERE id = ?').get(entityId) as
      | Record<string, unknown>
      | undefined;
    if (!row) {
      return [];
    }
    return [{ entity: rowToEntityNode(row), via: undefined }];
  }

  private runBfs({ fromId, toId, maxHops }: BfsSearch): Map<number, ParentEntry> | undefined {
    const adj = this.getAdjacencyCache();
    const visited = new Set<number>([fromId]);
    const parent = new Map<number, ParentEntry>();
    const queue: { id: number; hops: number }[] = [{ id: fromId, hops: 0 }];

    for (const current of iterateQueue(queue)) {
      if (current.hops >= maxHops) {
        continue;
      }
      for (const entry of adj.get(current.id) ?? []) {
        if (visited.has(entry.toId)) {
          continue;
        }
        visited.add(entry.toId);
        parent.set(entry.toId, {
          fromId: current.id,
          edgeId: entry.edgeId,
          type: entry.type,
          weight: entry.weight,
        });
        if (entry.toId === toId) {
          return parent;
        }
        queue.push({ id: entry.toId, hops: current.hops + 1 });
      }
    }
    return undefined;
  }

  private buildPath({ fromId, toId, parent }: PathBuild): EntityPathStep[] {
    const pathIds: number[] = [];
    let current = toId;
    while (current !== fromId) {
      pathIds.unshift(current);
      const entry = parent.get(current);
      if (!entry) {
        return [];
      }
      current = entry.fromId;
    }
    pathIds.unshift(fromId);

    return pathIds.map((entityId, index) => {
      const row = this.db.prepare('SELECT * FROM entities WHERE id = ?').get(entityId) as Record<
        string,
        unknown
      >;
      if (index === 0) {
        return { entity: rowToEntityNode(row), via: undefined };
      }
      const entry = parent.get(entityId);
      if (!entry) {
        return { entity: rowToEntityNode(row), via: undefined };
      }
      return {
        entity: rowToEntityNode(row),
        via: { edgeId: entry.edgeId, type: entry.type, weight: entry.weight },
      };
    });
  }

  private getAdjacencyCache(): Map<number, EdgeEntry[]> {
    if (!this.adjacencyCache) {
      this.adjacencyCache = new Map();
      const rows = this.db
        .prepare('SELECT id, from_id, to_id, type, weight FROM entity_edges')
        .all() as { id: number; from_id: number; to_id: number; type: string; weight: number }[];
      for (const row of rows) {
        const entries = this.adjacencyCache.get(row.from_id) ?? [];
        entries.push({ toId: row.to_id, edgeId: row.id, type: row.type, weight: row.weight });
        this.adjacencyCache.set(row.from_id, entries);
      }
    }
    return this.adjacencyCache;
  }
}

function* iterateQueue<T>(queue: T[]): Generator<T> {
  while (queue.length > 0) {
    const item = queue.shift();
    if (item !== undefined) {
      yield item;
    }
  }
}
