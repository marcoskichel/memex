## Why

The amygdala now extracts entity mentions during scoring. LTM needs to store them on the record and expose entity-based filtering at query time so callers can retrieve all memories mentioning a specific entity.

## What Changes

- Accept `metadata.entities: EntityMention[]` on `LtmInsertOptions` and persist it with the record
- Extend `LtmQueryOptions` with `entityName?: string` and `entityType?: EntityType` filters, applied as SQL WHERE clauses before scoring

## Capabilities

### New Capabilities

_(none — entity support is added to existing capabilities)_

### Modified Capabilities

- `ltm-storage`: `LtmRecord` shape gains `metadata.entities`; `LtmInsertOptions` accepts entity mentions
- `ltm-query`: `LtmQueryOptions` gains `entityName` and `entityType` filters

## Impact

- `nuclei/ltm/src/ltm-engine-types.ts` — `LtmRecord`, `LtmInsertOptions`, `LtmQueryOptions`
- `nuclei/ltm/src/storage/sqlite-schema.ts` — no new tables; entities stored as JSON in existing `metadata` column
- `nuclei/ltm/src/core/query-helpers.ts` or equivalent — entity filter applied in candidate pre-filter
- Adds `@neurome/cortex-ipc` as a dependency
