## Context

`LtmRecord` currently has no session identifier, no knowledge category, and no inline episode content. Session-scoped recall requires full-table metadata scans. Knowledge subcategories are impossible to filter without scanning untyped metadata bags. Episode content lives in external context files that become unreachable after STM clears. A single SQLite migration adds the three missing columns and unlocks all four capabilities.

## Goals / Non-Goals

**Goals:**

- Add `session_id`, `category`, `episode_summary` columns to `ltm_records` in one migration
- Extend `LtmRecord`, `StorageAdapter`, `LtmQueryOptions`, and `LtmInsertOptions` to surface the new fields
- Export `LtmCategory` well-known constants
- Allow direct semantic-tier insertion via `tier` option on insert

**Non-Goals:**

- Changing retrieval ranking logic (cosine, RRF, temporal) — new filters are pre-rank WHERE clauses only
- Full-text search on `episode_summary` — that is a V2 / BM25 concern
- Migrating existing context files into `episode_summary` retroactively
- Enforcing valid `LtmCategory` values at runtime — open string, validation is caller responsibility

## Decisions

### 1. `session_id NOT NULL DEFAULT 'legacy'`

`session_id` is NOT NULL because session-scoped queries must be indexable and NULL semantics complicate partial-index design. Existing records (pre-migration) are backfilled with `'legacy'` as a sentinel, not NULL. Callers querying for `sessionId: 'legacy'` will get all pre-migration records as a single cohort, which is correct behavior.

**Alternative considered:** nullable `session_id` with IS NOT NULL guard in the index — rejected because nullable foreign-key-like columns require special handling in every query that filters by session.

### 2. `category TEXT` nullable, no default

Category is optional — not every record warrants a category, and forcing a default category would pollute the taxonomy. Absence of a `category` filter in `LtmQueryOptions` returns all records regardless of category (standard SQL NULL semantics: unfiltered).

### 3. `episode_summary TEXT` nullable

Only episodic records produced by the amygdala carry an `episodeSummary`. Semantic records (produced by hippocampus consolidation) leave it NULL. The field is never computed inside `@memex/ltm` — it is always caller-supplied at insert time.

### 4. `tier` on `LtmInsertOptions` builds a semantic record via existing `buildSemanticRecord` helper

The `SqliteAdapter` already has `buildSemanticRecord` used internally by `persistConsolidatedRecord`. Exposing `tier: 'semantic'` on `insert()` routes through the same builder, requiring `confidence` in metadata (defaulted to `1.0` if absent). This avoids a separate code path and keeps semantic record construction consistent.

**Alternative considered:** a dedicated `insertSemantic()` method — rejected as unnecessary API surface when a single option accomplishes the same.

### 5. Index on `(session_id, tier, created_at)`

This composite index covers the primary access pattern: "give me all episodic records for session X ordered by time." It also covers category queries when combined with a WHERE on `category`. A separate single-column index on `category` is added for category-only queries.

## Risks / Trade-offs

- **`session_id NOT NULL` migration on large databases** → `DEFAULT 'legacy'` makes the migration instant (SQLite rewrites the schema without touching rows); no row-level backfill needed
- **`episode_summary` storage cost** → STM-compressed text is typically 200–800 chars per episode; at 10k records this is ~8MB worst case — acceptable inline
- **`tier: 'semantic'` bypass of amygdala** → Callers can insert malformed semantic records without `confidence`; mitigated by defaulting to `1.0` and documenting the contract clearly

## Migration Plan

1. Add migration `v2` to `sqlite-schema.ts`:
   - `ALTER TABLE ltm_records ADD COLUMN session_id TEXT NOT NULL DEFAULT 'legacy'`
   - `ALTER TABLE ltm_records ADD COLUMN category TEXT`
   - `ALTER TABLE ltm_records ADD COLUMN episode_summary TEXT`
   - `CREATE INDEX idx_ltm_session_tier_created ON ltm_records(session_id, tier, created_at)`
   - `CREATE INDEX idx_ltm_category ON ltm_records(category)`
2. Update `LtmRecord` type and all read paths in `SqliteAdapter` and `InMemoryAdapter`
3. Update write paths to accept and persist the new fields
4. Extend `LtmQueryOptions` with new filters; apply as WHERE clauses in `SqliteAdapter.query()`
5. Export `LtmCategory` from `index.ts`

**Rollback:** SQLite does not support `DROP COLUMN` before 3.35.0. Rollback strategy is to restore from a pre-migration backup. Document this constraint explicitly.
