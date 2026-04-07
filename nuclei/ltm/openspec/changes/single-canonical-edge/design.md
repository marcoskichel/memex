## Context

`entity_edges` stores directed relationships between entity nodes. The table was created in the V3 migration with no uniqueness constraint on `(from_id, to_id, type)`. The extraction pipeline calls `insertEntityEdge` for every edge the LLM emits per record. Two records can cause the LLM to emit the same triple, producing duplicate rows that make the graph redundant and potentially confusing for consumers.

## Goals / Non-Goals

**Goals:**

- Make `insertEntityEdge` idempotent: inserting a `(fromId, toId, type)` triple that already exists is a silent no-op
- Enforce uniqueness at the storage layer so all future callers get the same guarantee without custom logic

**Non-Goals:**

- Merging or updating existing duplicate edges already in databases created before this change
- Changing the return type of `insertEntityEdge` to expose whether the call was a no-op

## Decisions

**Enforce at storage layer, not process layer.**
Alternative: check for duplicates in `persistInsertPlan` before calling `insertEntityEdge`. Rejected because it doesn't protect future callers and is non-atomic.

**SQLite: `CREATE UNIQUE INDEX` + `INSERT OR IGNORE`.**
Adding a unique index on an existing table in SQLite is done via `CREATE UNIQUE INDEX IF NOT EXISTS` — no table recreation needed. Using `INSERT OR IGNORE` is the idiomatic SQLite pattern for upsert-without-update. `INSERT OR REPLACE` was rejected because it would change the `id` and `created_at` of the existing edge.

**Return value on no-op is unspecified.**
When `INSERT OR IGNORE` skips the insert, SQLite's `lastInsertRowid` returns the last successful insert id from the connection, not the existing edge's id. Looking up the existing id would require a SELECT, adding round-trips with no current use case. No caller uses the returned id for anything today.

**V4 migration.**
The unique index is added in a new `V4_MIGRATION` block in `sqlite-schema.ts`. Existing databases are upgraded when `runMigrations` runs. Databases with no existing duplicates upgrade cleanly. The migration is a no-op if already at V4.

**InMemoryAdapter: linear scan.**
For the in-memory adapter, check `entityEdges.values()` for an existing triple before inserting. O(n) but acceptable for test usage; no tree index needed.

## Risks / Trade-offs

[Existing duplicates] → Not cleaned up by this migration. Any duplicates already in a V3 database will remain. The unique index creation will fail if duplicates exist — migration should run `DELETE` to deduplicate before adding the index. Add a dedup step to the V4 migration.

[Return value ambiguity] → Callers expecting the new edge id on every call will get an undefined value on no-op. Currently no caller does this; document the behavior in the spec to prevent future misuse.
