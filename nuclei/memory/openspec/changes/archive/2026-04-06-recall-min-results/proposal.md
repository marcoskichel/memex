## Why

`memory.recall()` wraps `ltm.query()`. Now that `ltm` supports `minResults`, the memory layer should wire a sensible default so callers benefit automatically — particularly the cortex `getContext` handler, which runs three parallel recall queries and suffers most from empty results on open queries.

## What Changes

- `Memory.recall()` passes `minResults: 1` as a default in `LtmQueryOptions` unless the caller explicitly provides a different value.
- Callers can override by passing `{ minResults: 0 }` to restore the strict threshold-only behaviour.

## Capabilities

### New Capabilities

### Modified Capabilities

- `memory-orchestration`: `recall()` sets a default `minResults: 1` so open queries always return at least one record.

## Impact

- `packages/memory/src/memory-impl.ts` — set default `minResults: 1` in the `recall()` call to `ltm.query()`
