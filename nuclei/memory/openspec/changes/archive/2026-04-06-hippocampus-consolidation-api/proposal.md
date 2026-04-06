## Why

`HippocampusProcess.run()` is private and the `Memory` interface has no consolidation trigger. SDK consumers have no way to flush consolidation on demand — blocking testing, end-of-session cleanup, and scenarios where callers want to control when consolidation runs rather than relying on a background schedule.

## What Changes

- `Memory` interface SHALL expose `consolidate(): Promise<ConsolidationResult>` that triggers a hippocampus consolidation pass immediately.
- `MemoryImpl` SHALL delegate `consolidate()` to `HippocampusProcess.run()`.
- `MemoryConfig.hippocampusScheduleMs` SHALL accept `0` or `undefined` to disable the automatic schedule (manual-only mode), remaining backward-compatible for existing callers.
- `ConsolidationResult` SHALL be re-exported from `@memex/memory` so callers do not need to import from `@memex/hippocampus`.

## Capabilities

### New Capabilities

- `manual-consolidation`: `memory.consolidate()` triggers a hippocampus consolidation pass on demand.

### Modified Capabilities

- (none — no existing memory specs for this)

## Impact

- `packages/memory/src/memory-types.ts` — add `consolidate()` to `Memory` interface; re-export `ConsolidationResult`
- `packages/memory/src/memory-impl.ts` — implement `consolidate()` delegate to `hippocampus.run()`
- `packages/memory/src/memory-factory.ts` — pass `scheduleMs: 0` through when config disables schedule
