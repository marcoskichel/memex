## Context

The cortex IPC socket needs a `consolidate` request type so external tooling can
trigger a memory consolidation pass without restarting the daemon.

## Goals / Non-Goals

**Goals:**

- `consolidate` IPC request type dispatches to `memory.consolidate()`

**Non-Goals:**

- Returning structured consolidation results over IPC (void/undefined is sufficient)

## Decisions

- `ConsolidatePayload` is `Record<never, never>` (empty payload)
- Handler returns `undefined`; the socket client only needs fire-and-forget or await

## Risks / Trade-offs

- [Risk] Consolidation takes seconds; the IPC response will block during that time
  → Acceptable; callers should treat this as a slow operation
