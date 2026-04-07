## Context

`LtmRecord` already has a `metadata: Record<string, unknown>` field persisted as JSON in the SQLite `metadata` column. Entity mentions slot in as `metadata.entities: EntityMention[]` — no schema migration required.

Entity filtering at query time reuses the existing candidate pre-filter pattern (same layer as `sessionId` and `category` filters). The filter is applied as a SQL `json_each` query against the `metadata` column before records are loaded for embedding scoring.

## Goals / Non-Goals

**Goals:**

- Persist entity mentions as part of record metadata
- Allow callers to filter recall by entity name and/or type

**Non-Goals:**

- A dedicated `entities` SQLite table
- Entity deduplication or merging
- Cross-entity relationship queries

## Decisions

**Store entities in `metadata.entities`, not a new column.** The `metadata` column is already a JSON blob. Adding a new column or table for entities is Phase 2 work. JSON storage is sufficient for Phase 1's filtering needs.

**SQL `json_each` for filtering.** SQLite supports `json_each(metadata, '$.entities')` for filtering on JSON array contents. This avoids loading all records into memory before filtering, consistent with how `sessionId` and `category` filters work today.

**`entityName` filter is case-insensitive substring match.** Entity names extracted by the LLM may vary in casing ("TypeScript" vs "typescript"). Case-insensitive `LIKE` match is the simplest approach that handles this without requiring normalization at write time.

## Risks / Trade-offs

- JSON filtering via `json_each` is slower than an indexed column filter. Acceptable for Phase 1 — entity filtering is an optional, targeted query pattern, not the hot path. Phase 2 (dedicated `entities` table with indexes) resolves this if it becomes a bottleneck.
- Records written before entity tagging was added will have `metadata.entities = undefined`. Entity filters on those records return no matches — correct behavior, no special handling needed.
