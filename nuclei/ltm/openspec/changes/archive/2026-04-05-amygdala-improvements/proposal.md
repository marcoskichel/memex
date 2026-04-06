## Why

Amygdala now forwards agent-supplied tags to `LtmRecord.metadata.tags`. Without a corresponding query filter, those tags are stored but unretrievable by tag — agents cannot use them to scope recalls. `LtmQueryOptions` needs a `tags?: string[]` filter so callers can retrieve records matching all specified tags.

## What Changes

- `LtmQueryOptions` gains `tags?: string[]` — AND-semantics: a record must contain ALL specified tags in `metadata.tags` to match
- `filterCandidates` in `query-filters.ts` applies the tags filter against `record.metadata.tags`
- Both `SqliteAdapter.query()` and `InMemoryAdapter.query()` (via `filterCandidates`) respect the new filter

## Capabilities

### Modified Capabilities

- `ltm-query`: `LtmQueryOptions` extended with `tags?` array filter

## Impact

- `packages/ltm`: `ltm-engine-types.ts` (type change), `core/query-filters.ts` (filter logic)
- No schema migration required — tags live inside the existing `metadata` JSON column
- **Depends on `ltm-schema-extensions` being merged first** (prerequisite for the `tier` override used by amygdala singleton promotion, part of the same umbrella change)
