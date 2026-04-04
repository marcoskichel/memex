import type Database from 'better-sqlite3';

import type { LtmEdge, LtmRecord } from './storage-adapter.js';

export const FLOAT32_BYTES = 4;

export const SCHEMA = `
CREATE TABLE IF NOT EXISTS records (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  data TEXT,
  metadata TEXT NOT NULL DEFAULT '{}',
  embedding BLOB,
  embedding_model_id TEXT NOT NULL DEFAULT '',
  embedding_dimensions INTEGER NOT NULL DEFAULT 0,
  tier TEXT NOT NULL DEFAULT 'episodic',
  importance REAL NOT NULL DEFAULT 0,
  stability REAL NOT NULL DEFAULT 1,
  last_accessed_at INTEGER NOT NULL,
  access_count INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  tombstoned INTEGER NOT NULL DEFAULT 0,
  tombstoned_at INTEGER
);

CREATE TABLE IF NOT EXISTS edges (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  from_id INTEGER NOT NULL REFERENCES records(id),
  to_id INTEGER NOT NULL REFERENCES records(id),
  type TEXT NOT NULL,
  stability REAL NOT NULL DEFAULT 1,
  last_accessed_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS process_locks (
  process TEXT PRIMARY KEY,
  acquired_at INTEGER NOT NULL,
  ttl_ms INTEGER NOT NULL
);

CREATE VIRTUAL TABLE IF NOT EXISTS ltm_records_fts USING fts5(
  data,
  content='records',
  content_rowid='id'
);
`;

const V2_MIGRATION = [
  `ALTER TABLE records ADD COLUMN session_id TEXT NOT NULL DEFAULT 'legacy'`,
  `ALTER TABLE records ADD COLUMN category TEXT`,
  `ALTER TABLE records ADD COLUMN episode_summary TEXT`,
  `CREATE INDEX IF NOT EXISTS idx_ltm_session_tier_created ON records(session_id, tier, created_at)`,
  `CREATE INDEX IF NOT EXISTS idx_ltm_category ON records(category)`,
];

export function runMigrations(db: Database.Database): void {
  const version = db.pragma('user_version', { simple: true }) as number;
  if (version < 2) {
    db.transaction(() => {
      for (const sql of V2_MIGRATION) {
        db.exec(sql);
      }
      db.pragma('user_version = 2');
    })();
  }
}

export function rowToRecord(row: Record<string, unknown>): LtmRecord {
  const embeddingBuf = row.embedding as Buffer | undefined;
  return {
    id: row.id as number,
    data: row.data as string,
    metadata: JSON.parse(row.metadata as string) as Record<string, unknown>,
    embedding: embeddingBuf
      ? new Float32Array(
          embeddingBuf.buffer,
          embeddingBuf.byteOffset,
          embeddingBuf.byteLength / FLOAT32_BYTES,
        )
      : new Float32Array(0),
    embeddingMeta: {
      modelId: row.embedding_model_id as string,
      dimensions: row.embedding_dimensions as number,
    },
    tier: row.tier as 'episodic' | 'semantic',
    importance: row.importance as number,
    stability: row.stability as number,
    lastAccessedAt: new Date(row.last_accessed_at as number),
    accessCount: row.access_count as number,
    createdAt: new Date(row.created_at as number),
    tombstoned: (row.tombstoned as number) === 1,
    tombstonedAt: row.tombstoned_at ? new Date(row.tombstoned_at as number) : undefined,
    sessionId: (row.session_id as string | undefined) ?? 'legacy',
    ...(row.category != undefined && { category: row.category as string }),
    ...(row.episode_summary != undefined && { episodeSummary: row.episode_summary as string }),
  };
}

export function rowToEdge(row: Record<string, unknown>): LtmEdge {
  return {
    id: row.id as number,
    fromId: row.from_id as number,
    toId: row.to_id as number,
    type: row.type as LtmEdge['type'],
    stability: row.stability as number,
    lastAccessedAt: new Date(row.last_accessed_at as number),
    createdAt: new Date(row.created_at as number),
  };
}
