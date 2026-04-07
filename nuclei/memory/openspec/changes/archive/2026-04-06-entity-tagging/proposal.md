## Why

`memory.recall()` already accepts `LtmQueryOptions`. Since LTM now supports `entityName` and `entityType` filters, the unified memory interface gets entity filtering automatically — no additional wiring needed beyond passing options through. This proposal confirms the passthrough and documents it as a supported capability.

## What Changes

- `memory.recall()` passes `entityName` and `entityType` options through to `ltm.query()` (already happens via `LtmQueryOptions` passthrough — confirm no blocking)
- `Memory` interface documentation updated to surface entity filtering as a supported query pattern

## Capabilities

### New Capabilities

_(none)_

### Modified Capabilities

- `memory-orchestration`: `recall()` now supports `entityName` and `entityType` options via `LtmQueryOptions` passthrough

## Impact

- `nuclei/memory/src/memory-types.ts` — confirm `LtmQueryOptions` import includes the new entity fields (transitive via ltm package update)
- No new code required if `LtmQueryOptions` is already passed through unmodified
