import type { InsightEntry } from '../insight-log.js';

export const CREATE_INSIGHTS_TABLE = `
  CREATE TABLE IF NOT EXISTS insights (
    id TEXT PRIMARY KEY,
    summary TEXT NOT NULL,
    context_file TEXT NOT NULL,
    tags TEXT NOT NULL,
    timestamp INTEGER NOT NULL,
    processed INTEGER NOT NULL DEFAULT 0,
    safe_to_delete INTEGER
  )
`;

interface InsightRow {
  id: string;
  summary: string;
  context_file: string;
  tags: string;
  timestamp: number;
  processed: number;
  safe_to_delete: number | null;
}

export function rowToInsightEntry(row: InsightRow): InsightEntry {
  const safeToDeleteRaw = row.safe_to_delete;
  const safeToDelete = safeToDeleteRaw === 1 ? true : safeToDeleteRaw === 0 ? false : undefined;

  return {
    id: row.id,
    summary: row.summary,
    contextFile: row.context_file,
    tags: JSON.parse(row.tags) as string[],
    timestamp: new Date(row.timestamp),
    processed: row.processed === 1,
    ...(safeToDelete !== undefined && { safeToDelete }),
  };
}
