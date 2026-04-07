import Database from 'better-sqlite3';

import { rowToEdge, rowToRecord, runMigrations, SCHEMA } from './sqlite-schema.js';
import type {
  LtmEdge,
  LtmRecord,
  StorageAdapter,
  TombstonedRecord,
  UpdateEdgeStabilityParams,
  UpdateEmbeddingParams,
  UpdateStabilityParams,
} from './storage-adapter.js';

export class SqliteAdapter implements StorageAdapter {
  private db: Database.Database;

  constructor(dbPath: string) {
    this.db = new Database(dbPath);
    this.db.pragma('journal_mode = WAL');
    this.db.pragma('synchronous = NORMAL');
    this.db.exec(SCHEMA);
    runMigrations(this.db);
  }

  insertRecord(record: Omit<LtmRecord, 'id'>): number {
    const embeddingBuf = Buffer.from(
      record.embedding.buffer,
      record.embedding.byteOffset,
      record.embedding.byteLength,
    );
    const stmt = this.db.prepare(`
      INSERT INTO records (data, metadata, embedding, embedding_model_id, embedding_dimensions, tier, importance, stability, last_accessed_at, access_count, created_at, tombstoned, tombstoned_at, session_id, category, episode_summary)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const result = stmt.run(
      record.data,
      JSON.stringify(record.metadata),
      embeddingBuf,
      record.embeddingMeta.modelId,
      record.embeddingMeta.dimensions,
      record.tier,
      record.importance,
      record.stability,
      record.lastAccessedAt.getTime(),
      record.accessCount,
      record.createdAt.getTime(),
      record.tombstoned ? 1 : 0,
      record.tombstonedAt ? record.tombstonedAt.getTime() : undefined,
      record.engramId,
      record.category ?? undefined,
      record.episodeSummary ?? undefined,
    );
    const id = result.lastInsertRowid as number;
    this.db.prepare('INSERT INTO ltm_records_fts(rowid, data) VALUES (?, ?)').run(id, record.data);
    return id;
  }

  bulkInsertRecords(records: Omit<LtmRecord, 'id'>[]): number[] {
    const ids: number[] = [];
    const txn = this.db.transaction(() => {
      for (const record of records) {
        ids.push(this.insertRecord(record));
      }
    });
    txn();
    return ids;
  }

  getById(id: number): LtmRecord | TombstonedRecord | undefined {
    const row = this.db.prepare('SELECT * FROM records WHERE id = ?').get(id) as
      | Record<string, unknown>
      | undefined;
    if (!row) {
      return undefined;
    }
    if ((row.tombstoned as number) === 1) {
      return {
        id: row.id as number,
        tombstoned: true,
        tombstonedAt: new Date(row.tombstoned_at as number),
        data: undefined,
      };
    }
    return rowToRecord(row);
  }

  getAllRecords(): LtmRecord[] {
    const rows = this.db.prepare('SELECT * FROM records WHERE tombstoned = 0').all() as Record<
      string,
      unknown
    >[];
    return rows.map((row) => rowToRecord(row));
  }

  updateMetadata(id: number, patch: Record<string, unknown>): boolean {
    const existing = this.getById(id);
    if (!existing || ('tombstoned' in existing && existing.tombstoned)) {
      return false;
    }
    const record = existing;
    const merged = { ...record.metadata, ...patch };
    const result = this.db
      .prepare('UPDATE records SET metadata = ? WHERE id = ? AND tombstoned = 0')
      .run(JSON.stringify(merged), id);
    return result.changes > 0;
  }

  updateEmbedding(id: number, params: UpdateEmbeddingParams): void {
    const buf = Buffer.from(
      params.embedding.buffer,
      params.embedding.byteOffset,
      params.embedding.byteLength,
    );
    this.db
      .prepare(
        'UPDATE records SET embedding = ?, embedding_model_id = ?, embedding_dimensions = ? WHERE id = ?',
      )
      .run(buf, params.meta.modelId, params.meta.dimensions, id);
  }

  updateStability(id: number, params: UpdateStabilityParams): void {
    this.db
      .prepare(
        'UPDATE records SET stability = ?, last_accessed_at = ?, access_count = ? WHERE id = ?',
      )
      .run(params.stability, params.lastAccessedAt.getTime(), params.accessCount, id);
  }

  tombstoneRecord(id: number): void {
    const now = Date.now();
    const txn = this.db.transaction(() => {
      this.db
        .prepare(
          'UPDATE records SET tombstoned = 1, tombstoned_at = ?, data = NULL, embedding = NULL WHERE id = ?',
        )
        .run(now, id);
      this.db.prepare('DELETE FROM ltm_records_fts WHERE rowid = ?').run(id);
    });
    txn();
  }

  countTombstoned(): number {
    const row = this.db
      .prepare('SELECT COUNT(*) as count FROM records WHERE tombstoned = 1')
      .get() as { count: number };
    return row.count;
  }

  deleteRecord(id: number): boolean {
    const txn = this.db.transaction(() => {
      this.db.prepare('DELETE FROM ltm_records_fts WHERE rowid = ?').run(id);
      this.deleteEdgesFor(id);
      const result = this.db.prepare('DELETE FROM records WHERE id = ?').run(id);
      return result.changes > 0;
    });
    return txn();
  }

  insertEdge(edge: Omit<LtmEdge, 'id'>): number {
    const result = this.db
      .prepare(
        `INSERT INTO edges (from_id, to_id, type, stability, last_accessed_at, created_at) VALUES (?, ?, ?, ?, ?, ?)`,
      )
      .run(
        edge.fromId,
        edge.toId,
        edge.type,
        edge.stability,
        edge.lastAccessedAt.getTime(),
        edge.createdAt.getTime(),
      );
    return result.lastInsertRowid as number;
  }

  getEdge(id: number): LtmEdge | undefined {
    const row = this.db.prepare('SELECT * FROM edges WHERE id = ?').get(id) as
      | Record<string, unknown>
      | undefined;
    if (!row) {
      return undefined;
    }
    return rowToEdge(row);
  }

  edgesFrom(fromId: number): LtmEdge[] {
    const rows = this.db.prepare('SELECT * FROM edges WHERE from_id = ?').all(fromId) as Record<
      string,
      unknown
    >[];
    return rows.map((row) => rowToEdge(row));
  }

  edgesTo(toId: number): LtmEdge[] {
    const rows = this.db.prepare('SELECT * FROM edges WHERE to_id = ?').all(toId) as Record<
      string,
      unknown
    >[];
    return rows.map((row) => rowToEdge(row));
  }

  deleteEdgesFor(recordId: number): void {
    this.db.prepare('DELETE FROM edges WHERE from_id = ? OR to_id = ?').run(recordId, recordId);
  }

  updateEdgeStability(id: number, params: UpdateEdgeStabilityParams): void {
    this.db
      .prepare('UPDATE edges SET stability = ?, last_accessed_at = ? WHERE id = ?')
      .run(params.stability, params.lastAccessedAt.getTime(), id);
  }

  acquireLock(process: string, ttlMs: number): boolean {
    const txn = this.db.transaction(() => {
      const now = Date.now();
      const existing = this.db
        .prepare('SELECT * FROM process_locks WHERE process = ?')
        .get(process) as Record<string, unknown> | undefined;
      if (existing) {
        const acquiredAt = existing.acquired_at as number;
        const existingTtl = existing.ttl_ms as number;
        if (now < acquiredAt + existingTtl) {
          return false;
        }
        this.db.prepare('DELETE FROM process_locks WHERE process = ?').run(process);
      }
      this.db
        .prepare('INSERT INTO process_locks (process, acquired_at, ttl_ms) VALUES (?, ?, ?)')
        .run(process, now, ttlMs);
      return true;
    });
    return txn();
  }

  releaseLock(process: string): void {
    this.db.prepare('DELETE FROM process_locks WHERE process = ?').run(process);
  }

  async fork(outputPath: string): Promise<string> {
    await this.db.backup(outputPath);
    return outputPath;
  }
}
