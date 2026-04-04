## 1. Schema Migration

- [x] 1.1 Add migration `v2` to `sqlite-schema.ts`: `ALTER TABLE ltm_records ADD COLUMN session_id TEXT NOT NULL DEFAULT 'legacy'`
- [x] 1.2 Add `ALTER TABLE ltm_records ADD COLUMN category TEXT` to v2 migration
- [x] 1.3 Add `ALTER TABLE ltm_records ADD COLUMN episode_summary TEXT` to v2 migration
- [x] 1.4 Add `CREATE INDEX idx_ltm_session_tier_created ON ltm_records(session_id, tier, created_at)` to v2 migration
- [x] 1.5 Add `CREATE INDEX idx_ltm_category ON ltm_records(category)` to v2 migration
- [x] 1.6 Wire v2 migration into the schema versioning/upgrade path

## 2. Type Changes

- [x] 2.1 Add `sessionId: string` to `LtmRecord` in `ltm-engine-types.ts`
- [x] 2.2 Add `category?: string` to `LtmRecord`
- [x] 2.3 Add `episodeSummary?: string` to `LtmRecord`
- [x] 2.4 Add `sessionId?: string` and `category?: string` to `LtmQueryOptions`
- [x] 2.5 Add `tier?: 'episodic' | 'semantic'` to `LtmInsertOptions`
- [x] 2.6 Add `tier?: 'episodic' | 'semantic'` to `LtmBulkInsertOptions` entry type
- [x] 2.7 Export `LtmCategory` constants object from `index.ts`

## 3. StorageAdapter Updates

- [x] 3.1 Extend `StorageAdapter` interface: insert and read signatures include the three new fields
- [x] 3.2 Update `SqliteAdapter.insert()` to write `session_id`, `category`, `episode_summary`
- [x] 3.3 Update `SqliteAdapter.bulkInsert()` to write `session_id`, `category`, `episode_summary` per entry
- [x] 3.4 Update `SqliteAdapter` row-to-record mapping to read and populate the three new fields
- [x] 3.5 Update `InMemoryAdapter.insert()` and `InMemoryAdapter.bulkInsert()` to store the three new fields
- [x] 3.6 Update `InMemoryAdapter` query/get paths to return the three new fields

## 4. Query Filter

- [x] 4.1 Apply `sessionId` as SQL `WHERE session_id = ?` in `SqliteAdapter.query()` when present
- [x] 4.2 Apply `category` as SQL `WHERE category = ?` in `SqliteAdapter.query()` when present
- [x] 4.3 Apply equivalent in-memory filters in `InMemoryAdapter.query()` for both fields

## 5. Semantic Seeding

- [x] 5.1 In `SqliteAdapter.insert()`, when `tier === 'semantic'`, route through `buildSemanticRecord`; default `confidence` to `1.0` if absent from metadata
- [x] 5.2 Apply same logic in `InMemoryAdapter.insert()`
- [x] 5.3 Verify `bulkInsert` respects per-entry `tier`

## 6. Tests

- [x] 6.1 Unit test: insert with `sessionId` → retrieved record has correct `sessionId`
- [x] 6.2 Unit test: query with `sessionId` filter → only matching session records returned
- [x] 6.3 Unit test: insert with `category` → retrieved record has correct `category`
- [x] 6.4 Unit test: query with `category` filter → only matching records returned; uncategorised excluded
- [x] 6.5 Unit test: `LtmCategory` constants export correct string values
- [x] 6.6 Unit test: insert with `episodeSummary` → survives round-trip
- [x] 6.7 Unit test: semantic insert via `tier: 'semantic'` → stored with `tier === 'semantic'`; `confidence` defaults to `1.0`
- [x] 6.8 Unit test: mixed-tier `bulkInsert` → each record has correct tier
- [x] 6.9 Unit test: pre-migration sentinel — records with no `sessionId` return `'legacy'`
- [x] 6.10 Migration test: v1 → v2 migration on a populated database leaves existing rows intact with `session_id = 'legacy'`
