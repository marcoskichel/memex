## Why

`EntityType` in `@neurome/entorhinal` (after `extract-entorhinal-types` lands) is still
a closed union. `LtmQueryOptions.entityType` inherits this constraint. Widening to
`string` lets callers filter by any type including newly introduced ones like `screen`
without requiring a code change in ltm.

## What Changes

- `EntityType` in `@neurome/entorhinal` widened from closed union to `string`
- `LtmQueryOptions.entityType` accepts `string` (was `EntityType` union)
- No behavior change in query logic — `entityType` was always a string comparison filter

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `entity-graph-storage`: `EntityType` type definition changes from union to `string`

## Impact

- `nuclei/entorhinal/src/index.ts` — `EntityType = string`
- `nuclei/ltm/src/ltm-engine-types.ts` — `LtmQueryOptions.entityType` remains typed as
  `EntityType` (now `string`); no logic change
- Existing `EntityNode` rows in storage are unaffected; stored type strings are unchanged
