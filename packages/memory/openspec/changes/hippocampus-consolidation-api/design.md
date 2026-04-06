## Context

`Memory` interface needs a `consolidate()` method so SDK consumers can trigger
amygdala + hippocampus passes on demand. All three layers (amygdala, hippocampus,
cortex IPC) are already implemented.

## Goals / Non-Goals

**Goals:**

- `Memory.consolidate()` triggers amygdala then hippocampus run
- `MemoryConfig.hippocampusScheduleMs` passes through to hippocampus `scheduleMs`

**Non-Goals:**

- Returning a ConsolidationResult (void is sufficient for now)

## Decisions

- `consolidate()` returns `Promise<void>` — runs amygdala then hippocampus sequentially
- `memory-factory.ts` already passes `hippocampusScheduleMs` through when defined

## Risks / Trade-offs

- [Risk] Running amygdala + hippocampus back to back takes seconds
  → Acceptable for on-demand use; callers should await
