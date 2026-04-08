## Context

`EntityExtractionProcess.run()` currently returns `ResultAsync<void, ExtractionError>`. Callers get no observability into how many records were processed or how many entity nodes were created. For `@neurome/memory` to expose perirhinal stats alongside amygdala/hippocampus stats, perirhinal needs to return structured metrics from `run()`.

## Goals / Non-Goals

**Goals:**

- `run()` returns `ResultAsync<PerirhinalStats, ExtractionError>` with counts for records processed, entities inserted, entities reused, and errors
- `PerirhinalStats` and `EntityExtractionProcess` are exported from `index.ts` for consumption by `@neurome/memory`

**Non-Goals:**

- No new scheduling logic inside perirhinal — scheduling remains the caller's responsibility
- No event bus inside perirhinal — events are emitted by the `memory` scope

## Decisions

**Return stats instead of void from `run()`**

`persistInsertPlan` is the final step and has full visibility into what was inserted vs reused. Stats can be accumulated there and returned up the call chain through `executePlan` → `processRecord` → `processUnlinkedRecords` → `run()`.

Alternative considered: emit events from within perirhinal. Rejected — it would require injecting an event bus and couples perirhinal to the memory event schema. Returning stats keeps perirhinal pure and lets the caller (memory) emit whatever events it needs.

**`PerirhinalStats` shape**

```ts
export interface PerirhinalStats {
  recordsProcessed: number;
  entitiesInserted: number;
  entitiesReused: number;
  errors: number;
}
```

Simple counts, no timestamps — the caller (memory) can attach timestamps when it records the stats.

**No `PerirhinalProcess` wrapper class**

`EntityExtractionProcess` already has the right surface. Exporting it directly avoids an unnecessary indirection layer. The `memory` scope imports `EntityExtractionProcess` and `PerirhinalStats` directly.

## Risks / Trade-offs

- `processRecord` currently short-circuits with `okAsync()` for records with no extractable input. These should count as processed (not errors) so callers don't misinterpret the stats. → Handled by accumulating stats only for records that enter the full pipeline, leaving no-op records uncounted.

## Migration Plan

Additive change — enriching the return type of `run()` from `void` to `PerirhinalStats` is a breaking change for any existing caller. Current callers: only the e2e script (`assertOk(result, ...)`) which ignores the value. The e2e script requires no changes.
