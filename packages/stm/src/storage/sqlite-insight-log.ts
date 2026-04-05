import Database from 'better-sqlite3';

import type { InsightEntry } from '../insight-log.js';
import { CREATE_INSIGHTS_TABLE, rowToInsightEntry } from './sqlite-insight-schema.js';

export class SqliteInsightLog {
  private db: Database.Database;

  constructor(dbPath: string) {
    this.db = new Database(dbPath);
    this.db.pragma('journal_mode = WAL');
    this.db.pragma('synchronous = NORMAL');
    this.db.exec(CREATE_INSIGHTS_TABLE);
  }

  append(entry: Omit<InsightEntry, 'id' | 'timestamp' | 'processed'>): InsightEntry {
    const id = crypto.randomUUID();
    const timestamp = Date.now();

    this.db
      .prepare(
        `INSERT INTO insights (id, summary, context_file, tags, timestamp, processed, safe_to_delete)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        id,
        entry.summary,
        entry.contextFile,
        JSON.stringify(entry.tags),
        timestamp,
        0,
        entry.safeToDelete === true ? 1 : entry.safeToDelete === false ? 0 : undefined,
      );

    return {
      id,
      summary: entry.summary,
      contextFile: entry.contextFile,
      tags: entry.tags,
      timestamp: new Date(timestamp),
      processed: false,
      ...(entry.safeToDelete !== undefined && { safeToDelete: entry.safeToDelete }),
    };
  }

  readUnprocessed(): InsightEntry[] {
    const rows = this.db
      .prepare('SELECT * FROM insights WHERE processed = 0 ORDER BY timestamp ASC')
      .all();
    return rows.map((row) => rowToInsightEntry(row as Parameters<typeof rowToInsightEntry>[0]));
  }

  markProcessed(ids: string[]): void {
    if (ids.length === 0) {
      return;
    }
    const placeholders = ids.map(() => '?').join(', ');
    this.db.prepare(`UPDATE insights SET processed = 1 WHERE id IN (${placeholders})`).run(...ids);
  }

  clear(): void {
    this.db.prepare('DELETE FROM insights WHERE processed = 1').run();
  }

  allEntries(): InsightEntry[] {
    const rows = this.db.prepare('SELECT * FROM insights').all();
    return rows.map((row) => rowToInsightEntry(row as Parameters<typeof rowToInsightEntry>[0]));
  }
}
