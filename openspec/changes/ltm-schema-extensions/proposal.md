## Why

The LTM record schema is missing three fields that prevent session-scoped retrieval, knowledge categorisation, and full-episode reconstruction. A post-implementation coverage review identified these as gaps that limit what agents can actually do with the memory system. All three require a single coordinated SQLite migration, so they ship together.

## What Changes

- **BREAKING** `LtmRecord` gains three new fields: `sessionId`, `category?`, `episodeSummary?`
- **BREAKING** SQLite schema: one migration adding `session_id TEXT NOT NULL`, `category TEXT`, `episode_summary TEXT`
- `LtmQueryOptions` gains `sessionId?` and `category?` filters
- `LtmInsertOptions` gains `tier?` override enabling direct semantic seeding
- `LtmCategory` exported constants object added to `@memex/ltm`
- Amygdala writes `sessionId` and `episodeSummary` to every record it inserts; marks context files `safeToDelete` immediately after
- Hippocampus `ConsolidateOptions` gains optional `category?`; deletion logic simplified (no longer needs to cross-reference LTM records before deleting context files)
- `Memory` interface gains `recallSession()` and `recallFull()`

## Capabilities

### New Capabilities

- `ltm-session-recall`: session-scoped episodic retrieval via indexed `session_id` column
- `ltm-knowledge-taxonomy`: open `category` field with exported well-known constants enabling typed knowledge namespacing
- `ltm-episode-summary`: inline high-fidelity episode summary on each episodic record, replacing fragile context file path references
- `ltm-semantic-seeding`: direct insertion of semantic-tier records without routing through the amygdala pipeline

### Modified Capabilities

- `ltm-storage`: `LtmRecord` shape changes (three new fields); insert options extended with `tier?`
- `ltm-query`: query options extended with `sessionId?` and `category?` filters
- `amygdala-scoring`: write path extended to populate `sessionId` and `episodeSummary`; `safeToDelete` timing moved earlier
- `hippocampus-consolidation`: `ConsolidateOptions` extended with `category?`; context file deletion simplified

## Impact

- All four scopes: `ltm`, `amygdala`, `hippocampus`, `memory`
- SQLite schema migration required for existing databases (adds three nullable/defaulted columns)
- `session_id NOT NULL` is a breaking schema change — existing records must be backfilled or migration must supply a default (e.g. `'legacy'`)
- Must be implemented before `amygdala-improvements` (Change 2), which writes to the new fields
