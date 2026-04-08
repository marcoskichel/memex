## Context

Cortex maintains `MEMORY_EVENT_NAMES`, an explicit allowlist of `MemoryEvents` keys to forward to connected clients. Adding a new event to `MemoryEvents` doesn't automatically broadcast it — the name must be listed here. This is the only change needed in cortex.

## Goals / Non-Goals

**Goals:**

- `perirhinal:extraction:end` is forwarded to connected clients after each entity extraction run

**Non-Goals:**

- No IPC protocol changes — event broadcast is already handled generically
- No new cortex dependencies

## Decisions

**Extend MEMORY_EVENT_NAMES, no other changes**

The broadcast mechanism in `cortex-core.ts` is already generic — it loops over `MEMORY_EVENT_NAMES` and registers listeners. Adding one string to the array is sufficient.

## Risks / Trade-offs

- No risks. Additive, one-line change.
