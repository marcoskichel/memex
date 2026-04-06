## Why

The hippocampus runs on a fixed 1-hour schedule regardless of agent state. Real hippocampal consolidation is gated by behavioural state (quiet wakefulness, sleep) — it doesn't run continuously while the agent is active. Additionally, there is no way for SDK consumers to trigger a consolidation pass manually, which blocks testing, end-of-session flushing, and integration workflows.

## What Changes

- `HippocampusProcess` SHALL expose a public `run()` method so callers can trigger a consolidation pass on demand.
- `Memory` interface SHALL expose a `consolidate(): Promise<ConsolidationResult>` method that delegates to `HippocampusProcess.run()`.
- The cortex IPC protocol SHALL expose a `consolidate` request type so the consolidation trigger is reachable from hook integrations.
- The default scheduled consolidation MUST remain opt-in and backward-compatible — if `scheduleMs` is set, the interval still runs.
- `MemoryConfig.hippocampusScheduleMs` SHOULD accept `0` or `undefined` to disable the automatic schedule entirely (manual-only mode).

## Capabilities

### New Capabilities

- `manual-consolidation`: SDK consumers can trigger a hippocampus consolidation pass on demand via `memory.consolidate()`.

### Modified Capabilities

- `hippocampus-process`: `run()` becomes public. Schedule is optional (disabled when `scheduleMs` is `0` or `undefined`).

## Impact

- `packages/hippocampus/src/hippocampus-process.ts` — make `run()` public
- `packages/memory/src/memory-types.ts` — add `consolidate()` to `Memory` interface
- `packages/memory/src/memory-impl.ts` — implement `consolidate()` delegate
- `packages/cortex/src/ipc/protocol.ts` — add `consolidate` request type
- `packages/cortex/src/ipc/handlers.ts` — add `consolidate` dispatch case
