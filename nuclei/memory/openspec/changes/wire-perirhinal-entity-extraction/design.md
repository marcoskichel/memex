## Context

`createMemory` currently wires two processes: `AmygdalaProcess` (STM→LTM consolidation) and `HippocampusProcess` (episodic→semantic consolidation). `EntityExtractionProcess` from `@neurome/perirhinal` exists and is fully functional but is never instantiated in the memory factory.

The existing `amygdala:cycle:end` event fires after each amygdala batch. This is the natural trigger for perirhinal — it runs immediately after the records that need entity extraction are created, matching the brain model where perirhinal fires co-actively with hippocampal encoding.

## Goals / Non-Goals

**Goals:**

- Perirhinal runs automatically after each amygdala cycle — no separate timer, no manual calls
- `MemoryStats.perirhinal` exposes last-run metrics
- `perirhinal:extraction:end` event is emitted for observers (cortex)

**Non-Goals:**

- No retry or error recovery inside memory — `ExtractionError` is logged to stderr and stats reflect the failure
- No changes to how `EntityExtractionProcess` works internally
- No changes to STM, LTM, hippocampus, or amygdala

## Decisions

**Trigger: `amygdala:cycle:end` event, not a timer**

The amygdala just inserted records — those are exactly the unlinked records perirhinal needs to process. Reacting to the event avoids redundant polls and aligns with the brain model. A separate timer would introduce unnecessary lag and empty-poll overhead.

Alternative: Run perirhinal on its own interval. Rejected — adds configuration surface and introduces latency between amygdala inserts and entity linking.

**Embed adapter: wrap `EmbeddingAdapter` inline in factory**

`EntityExtractionProcess` requires `embedEntity: (entity: ExtractedEntity) => Promise<Float32Array>`. `createMemory` already receives `embeddingAdapter: EmbeddingAdapter`. The adapter is built inline:

```ts
embedEntity: async (entity) => {
  const result = await embeddingAdapter.embed(`${entity.name} (${entity.type})`);
  if (result.isErr()) throw new Error(result.error.type);
  return result.value.vector;
};
```

This is the same pattern used in the perirhinal e2e script — no new abstraction needed.

**Stats tracking: mirror amygdala pattern**

`MemoryImpl` already accumulates `amygdalaStats` via events. `perirhinalStats` follows the same pattern: initialized to zeros, updated on `perirhinal:extraction:end`.

**`MemoryImplDeps.perirhinalProcess` is optional**

Keeps `MemoryImpl` testable without a real perirhinal process. The factory always provides it; tests can omit it.

## Risks / Trade-offs

- [Perirhinal run blocks amygdala cycle cleanup] → `run()` is called fire-and-forget (`.then()` not awaited in the event handler). The amygdala cycle:end handler returns synchronously. Perirhinal failure does not block the next amygdala cycle.
- [Concurrent runs if amygdala fires fast] → `EntityExtractionProcess` uses `StorageAdapter.acquireLock`. Concurrent calls return `LOCK_FAILED` silently and skip — existing behavior, no change needed.

## Migration Plan

Additive change. Existing `createMemory` callers gain entity extraction automatically with no API change. `MemoryStats` gains a new `perirhinal` field — existing consumers reading other fields are unaffected.
