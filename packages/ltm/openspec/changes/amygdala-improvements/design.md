## Context

`LtmRecord.metadata` is a `Record<string, unknown>` JSON blob. The `filterCandidates` function in `query-filters.ts` applies all in-memory pre-scoring filters. The SQLite adapter calls `getAllRecords()` and passes the result to `filterCandidates`, so a new filter added there applies to both adapters without touching adapter-specific code.

Tags are stored in `metadata.tags` as `string[]` by amygdala. When a tag filter is supplied in `LtmQueryOptions`, `filterCandidates` must check that every tag in the filter appears in `metadata.tags`.

## Goals / Non-Goals

**Goals:**

- Add `tags?: string[]` to `LtmQueryOptions`
- Apply AND-semantics filter in `filterCandidates`: all specified tags must be present
- Keep the change minimal — no schema migration, no new index

**Non-Goals:**

- OR-semantics tag matching
- Indexing tags in SQLite (tags live in the JSON metadata column; a full-text or JSON index is a separate performance concern)
- Changing how tags are stored

## Decisions

### Filter implemented in `filterCandidates`, not in SQL

Tags are stored inside the `metadata` JSON column, not in a dedicated SQL column. Filtering in SQL would require a JSON function (`json_each` or `json_extract`) and is SQLite-version-dependent. Since `filterCandidates` is already the canonical in-memory filter stage for both adapters, adding the tags check there is simpler, consistent, and avoids SQLite JSON function complexity. Performance is acceptable given the existing pattern — tags filter reduces the candidate set before embedding scoring.

### AND-semantics chosen over OR-semantics

Agent use cases (e.g. "retrieve all memories tagged `['behavioral', 'preference']`") typically want records that satisfy all specified tags, not any one of them. AND-semantics is the safer default; callers can make multiple queries for OR behavior.

### Records with missing or non-array `metadata.tags` are excluded when a tags filter is specified

If `metadata.tags` is absent or not an array, the record does not contain any of the specified tags, so it correctly fails the AND filter. No special-casing required — the filter naturally excludes such records.

## Risks / Trade-offs

- **In-memory filter only**: no SQL-side pre-filter means all records are loaded before tag filtering. Acceptable at current scale; a dedicated `tags` column with an index is a future optimization if tag queries become hot paths.
