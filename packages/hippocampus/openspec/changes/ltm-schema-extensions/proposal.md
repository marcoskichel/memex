## Why

Hippocampus needs two small updates for the `ltm-schema-extensions` schema: `ConsolidateOptions` gains an optional `category` so consolidated semantic records can be categorised, and the context file deletion logic is simplified now that amygdala marks files `safeToDelete` immediately (no cross-reference against LTM records needed).

## What Changes

- `ConsolidateOptions` gains `category?: string`; hippocampus passes it through to `ltm.consolidate()`
- Context file deletion simplified: delete all `safeToDelete = true` files unconditionally; no LTM record cross-reference

## Capabilities

### New Capabilities

_(none)_

### Modified Capabilities

- `hippocampus-consolidation`: `ConsolidateOptions` extended; deletion logic simplified

## Impact

- `packages/hippocampus`: `hippocampus-schema.ts` (options type), `hippocampus-process.ts` (consolidation and deletion)
- Requires `@memex/ltm` `ltm-schema-extensions` and `@memex/amygdala` `ltm-schema-extensions` to be merged first
