## Why

`EntityExtractionProcess` is fully built and tested but exports only the class itself — no schedulable interface, no stats shape, and no event contracts. The `memory` scope needs to instantiate and observe perirhinal as a first-class process alongside amygdala and hippocampus.

## What Changes

- Add `PerirhinalStats` type capturing last-run metrics (records processed, entities inserted, entities reused, errors)
- Add `PerirhinalProcess` wrapper/interface that exposes `run(): ResultAsync<PerirhinalStats, ExtractionError>` — same surface as amygdala/hippocampus
- Export `PerirhinalStats`, `PerirhinalProcess`, and all existing types needed by consumers from `index.ts`

## Capabilities

### New Capabilities

- `schedulable-process`: Expose `PerirhinalProcess` with a `run()` method returning stats, and the `PerirhinalStats` type, so `@neurome/memory` can treat perirhinal as a schedulable process alongside amygdala and hippocampus

### Modified Capabilities

- `entity-extraction-process`: `EntityExtractionProcess.run()` return type enriched — currently returns `ResultAsync<void, ExtractionError>`, needs to return `ResultAsync<PerirhinalStats, ExtractionError>` so callers get observability

## Impact

- `src/shell/entity-extraction-process.ts` — `run()` and `executePlan()` return stats
- `src/index.ts` — export `PerirhinalProcess`, `PerirhinalStats`, and all consumer-facing types
- `@neurome/memory` (consumer) — imports `PerirhinalStats` and `EntityExtractionProcess`
