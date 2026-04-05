## Why

`LtmRecord` is missing three fields identified in a post-implementation coverage review: a session identifier for scoped retrieval, a knowledge category for typed namespacing, and an inline episode summary that eliminates fragile context file path references. All three require the same SQLite migration, so they ship together with a direct semantic seeding capability that removes the last forced route through the amygdala pipeline.

## What Changes

- **BREAKING** `LtmRecord` gains `sessionId: string`, `category?: string`, `episodeSummary?: string`
- **BREAKING** SQLite migration: adds `session_id TEXT NOT NULL DEFAULT 'legacy'`, `category TEXT`, `episode_summary TEXT`; index on `(session_id, tier, created_at)`
- `LtmQueryOptions` gains `sessionId?: string` and `category?: string` filters
- `LtmInsertOptions` gains `tier?: 'episodic' | 'semantic'` enabling direct semantic seeding without routing through the amygdala
- `LtmCategory` exported constants object added to public API
- `StorageAdapter` interface extended to support the new fields on read and write paths

## Capabilities

### New Capabilities

- `ltm-session-recall`: indexed `session_id` column and `sessionId` query filter enabling O(log n) session-scoped record retrieval
- `ltm-knowledge-taxonomy`: open `category` string field with `LtmCategory` well-known constants; `category` filter in query options; `category` option in `ConsolidateOptions` (hippocampus scope)
- `ltm-episode-summary`: nullable `episode_summary` column stores inline STM-compressed text for episodic records; enables full-episode reconstruction without context file dependencies
- `ltm-semantic-seeding`: `tier` option on `LtmInsertOptions` allows direct insertion of semantic-tier records with caller-supplied `confidence`

### Modified Capabilities

- `ltm-storage`: `LtmRecord` shape extended with three new fields; `StorageAdapter.insert()` and `StorageAdapter.bulkInsert()` extended to accept and persist the new fields
- `ltm-query`: `LtmQueryOptions` extended with `sessionId?` and `category?` filters; both fields indexed and applied as SQL WHERE clauses before cosine scoring

## Impact

- `packages/ltm`: schema migration, type changes, adapter updates, public API additions
- Downstream scopes (`amygdala`, `hippocampus`, `memory`) must update to write/read the new fields — covered in their per-scope changes
- Existing databases need migration: `session_id NOT NULL` backfilled with `'legacy'`; `category` and `episode_summary` nullable, no backfill needed
