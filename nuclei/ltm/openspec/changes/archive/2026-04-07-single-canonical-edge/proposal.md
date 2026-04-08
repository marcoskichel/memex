## Why

Multiple records processed by the extraction pipeline can produce identical directed relationships (same `fromId`, `toId`, and `type`). Without a uniqueness constraint on `entity_edges`, each such observation inserts a new row. A knowledge graph edge represents whether a relationship exists — not how many times it was observed.

## What Changes

- V4 SQLite migration: add `CREATE UNIQUE INDEX` on `entity_edges(from_id, to_id, type)`
- `SqliteAdapter.insertEntityEdge`: switch to `INSERT OR IGNORE` — duplicate calls become no-ops, return value is unspecified when ignored
- `InMemoryAdapter.insertEntityEdge`: check for existing `(fromId, toId, type)` before inserting; return existing id if found

## Capabilities

### New Capabilities

_(none)_

### Modified Capabilities

- `entity-graph-storage`: `insertEntityEdge` gains an idempotency requirement — inserting a duplicate `(fromId, toId, type)` triple SHALL be a no-op

## Impact

- `entity_edges` table: new unique index (V4 migration, additive)
- `SqliteAdapter`: `insertEntityEdge` — behavior change on duplicates (silent ignore instead of insert)
- `InMemoryAdapter`: `insertEntityEdge` — same behavior change
- Callers of `insertEntityEdge` that relied on always getting a new row will get a no-op instead (no current callers do this)
