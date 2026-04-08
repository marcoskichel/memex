## Why

The memory pipeline has no entity extraction step. Amygdala inserts LTM records with `metadata.entities` but `EntityExtractionProcess` is never started, leaving the entity graph permanently empty. Entity-aware recall, graph traversal, and `findEntityPath` are all dead code in a running system.

## What Changes

- Add `@neurome/perirhinal` as a dependency
- In `createMemory`, instantiate `EntityExtractionProcess` and subscribe it to `amygdala:cycle:end` — triggering `run()` immediately after each amygdala batch, mirroring perirhinal co-activity with the hippocampus in the brain
- Add `PerirhinalStats` to `MemoryStats` so callers can observe entity extraction activity
- Emit a `perirhinal:extraction:end` event after each run for cortex to broadcast

## Capabilities

### New Capabilities

- `perirhinal-orchestration`: `createMemory` instantiates and schedules `EntityExtractionProcess`, reactive to `amygdala:cycle:end`

### Modified Capabilities

- `memory-orchestration`: `MemoryStats` gains a `perirhinal` field; `MemoryImplDeps` gains an optional `perirhinalProcess` dependency; `createMemory` wires the process

## Impact

- `src/memory-factory.ts` — instantiate `EntityExtractionProcess`, pass embed adapter, subscribe to `amygdala:cycle:end`
- `src/memory-impl.ts` — track `perirhinalStats`, handle `perirhinal:extraction:end` event
- `src/memory-types.ts` — add `PerirhinalStats` to `MemoryStats`, add `perirhinalProcess` to `MemoryImplDeps`, add event types
- `src/memory-events.ts` — add `perirhinal:extraction:end` event shape
- `package.json` — add `@neurome/perirhinal` dependency
