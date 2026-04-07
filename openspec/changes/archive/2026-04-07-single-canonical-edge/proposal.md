## Why

Multiple LTM records can cause the extraction pipeline to emit the same directed relationship (e.g. `Maya → Atlas [leads]`) across separate runs. Because `entity_edges` has no uniqueness constraint, each run inserts a new row, producing a graph with redundant parallel edges between the same node pair. A knowledge graph should treat a relationship as either present or absent — not as an accumulating count of observations.

## What Changes

- Add `UNIQUE(from_id, to_id, type)` constraint to `entity_edges` via a V4 SQLite migration
- Change `SqliteAdapter.insertEntityEdge` to use `INSERT OR IGNORE` so duplicate calls are silent no-ops
- Update `InMemoryAdapter.insertEntityEdge` to mirror the same idempotency semantics
- Update `entity-graph-storage` spec to document the new idempotency requirement on `insertEntityEdge`
- Update `entity-extraction-process` spec to clarify that `persistInsertPlan` edge writes are idempotent

## Scopes

- **ltm**: schema migration, SqliteAdapter, InMemoryAdapter, entity-graph-storage spec
- **perirhinal**: entity-extraction-process spec (edge persistence semantics)
