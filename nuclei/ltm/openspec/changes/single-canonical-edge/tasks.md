## 1. Schema Migration

- [ ] 1.1 Add `V4_MIGRATION` constant in `sqlite-schema.ts` with a dedup DELETE and `CREATE UNIQUE INDEX IF NOT EXISTS idx_entity_edges_unique ON entity_edges(from_id, to_id, type)`
- [ ] 1.2 Bump `SCHEMA_VERSION` to 4 and add V4 migration branch to `runMigrations`
- [ ] 1.3 Unit test: V3 database upgrades to V4 (index exists, version = 4)
- [ ] 1.4 Unit test: V4 migration is a no-op on an already-V4 database

## 2. SqliteAdapter

- [ ] 2.1 Change `insertEntityEdge` in `sqlite-entity-graph.ts` to use `INSERT OR IGNORE INTO entity_edges`
- [ ] 2.2 Unit test: inserting the same `(fromId, toId, type)` triple twice produces one row in `entity_edges`
- [ ] 2.3 Unit test: inserting same node pair with different types produces two rows

## 3. InMemoryAdapter

- [ ] 3.1 Update `insertEntityEdge` in `in-memory-adapter.ts` to scan for existing `(fromId, toId, type)` and return existing id if found
- [ ] 3.2 Unit test: InMemoryAdapter mirrors the same idempotency behavior as SqliteAdapter
