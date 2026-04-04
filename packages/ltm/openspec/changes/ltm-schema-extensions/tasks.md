## 1. Schema Migration

- [ ] 1.1 Add migration `v2` to `sqlite-schema.ts`: `ALTER TABLE ltm_records ADD COLUMN session_id TEXT NOT NULL DEFAULT 'legacy'`
- [ ] 1.2 Add `ALTER TABLE ltm_records ADD COLUMN category TEXT` to v2 migration
- [ ] 1.3 Add `ALTER TABLE ltm_records ADD COLUMN episode_summary TEXT` to v2 migration
- [ ] 1.4 Add `CREATE INDEX idx_ltm_session_tier_created ON ltm_records(session_id, tier, created_at)` to v2 migration
- [ ] 1.5 Add `CREATE INDEX idx_ltm_category ON ltm_records(category)` to v2 migration
- [ ] 1.6 Wire v2 migration into the schema versioning/upgrade path

## 2. Type Changes

- [ ] 2.1 Add `sessionId: string` to `LtmRecord` in `ltm-engine-types.ts`
- [ ] 2.2 Add `category?: string` to `LtmRecord`
- [ ] 2.3 Add `episodeSummary?: string` to `LtmRecord`
- [ ] 2.4 Add `sessionId?: string` and `category?: string` to `LtmQueryOptions`
- [ ] 2.5 Add `tier?: 'episodic' | 'semantic'` to `LtmInsertOptions`
- [ ] 2.6 Add `tier?: 'episodic' | 'semantic'` to `LtmBulkInsertOptions` entry type
- [ ] 2.7 Export `LtmCategory` constants object from `index.ts`

## 3. StorageAdapter Updates

- [ ] 3.1 Extend `StorageAdapter` interface: insert and read signatures include the three new fields
- [ ] 3.2 Update `SqliteAdapter.insert()` to write `session_id`, `category`, `episode_summary`
- [ ] 3.3 Update `SqliteAdapter.bulkInsert()` to write `session_id`, `category`, `episode_summary` per entry
- [ ] 3.4 Update `SqliteAdapter` row-to-record mapping to read and populate the three new fields
- [ ] 3.5 Update `InMemoryAdapter.insert()` and `InMemoryAdapter.bulkInsert()` to store the three new fields
- [ ] 3.6 Update `InMemoryAdapter` query/get paths to return the three new fields

## 4. Query Filter

- [ ] 4.1 Apply `sessionId` as SQL `WHERE session_id = ?` in `SqliteAdapter.query()` when present
- [ ] 4.2 Apply `category` as SQL `WHERE category = ?` in `SqliteAdapter.query()` when present
- [ ] 4.3 Apply equivalent in-memory filters in `InMemoryAdapter.query()` for both fields

## 5. Semantic Seeding

- [ ] 5.1 In `SqliteAdapter.insert()`, when `tier === 'semantic'`, route through `buildSemanticRecord`; default `confidence` to `1.0` if absent from metadata
- [ ] 5.2 Apply same logic in `InMemoryAdapter.insert()`
- [ ] 5.3 Verify `bulkInsert` respects per-entry `tier`

## 6. Tests

- [ ] 6.1 Unit test: insert with `sessionId` → retrieved record has correct `sessionId`
- [ ] 6.2 Unit test: query with `sessionId` filter → only matching session records returned
- [ ] 6.3 Unit test: insert with `category` → retrieved record has correct `category`
- [ ] 6.4 Unit test: query with `category` filter → only matching records returned; uncategorised excluded
- [ ] 6.5 Unit test: `LtmCategory` constants export correct string values
- [ ] 6.6 Unit test: insert with `episodeSummary` → survives round-trip
- [ ] 6.7 Unit test: semantic insert via `tier: 'semantic'` → stored with `tier === 'semantic'`; `confidence` defaults to `1.0`
- [ ] 6.8 Unit test: mixed-tier `bulkInsert` → each record has correct tier
- [ ] 6.9 Unit test: pre-migration sentinel — records with no `sessionId` return `'legacy'`
- [ ] 6.10 Migration test: v1 → v2 migration on a populated database leaves existing rows intact with `session_id = 'legacy'`
