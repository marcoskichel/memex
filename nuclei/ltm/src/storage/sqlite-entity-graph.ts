import type Database from 'better-sqlite3';

import { MAX_ENTITY_NEIGHBOR_DEPTH, rowToEntityNode } from './sqlite-schema.js';
import type { EntityEdge, EntityNode } from './storage-adapter.js';

export class SqliteEntityGraph {
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

  insertEntityEdge(edge: Omit<EntityEdge, 'id'>): number {
    const result = this.db
      .prepare(
        'INSERT OR IGNORE INTO entity_edges (from_id, to_id, type, created_at) VALUES (?, ?, ?, ?)',
      )
      .run(edge.fromId, edge.toId, edge.type, edge.createdAt.getTime());
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
}
