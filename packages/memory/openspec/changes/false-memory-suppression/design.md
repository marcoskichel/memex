## Context

The `hippocampus:false-memory-risk` event now carries a full `PendingConsolidation`
payload (pendingId, summary, confidence, sourceIds, etc.) instead of a recordId.
MemoryImpl must store these in-process and expose review methods.

## Goals / Non-Goals

**Goals:**

- `getPendingConsolidations()` returns all pending items
- `approveConsolidation(id)` inserts the pending record into LTM
- `discardConsolidation(id)` drops it
- TTL auto-discard: purge entries older than `pendingConsolidationTtlMs` on `consolidate()`

**Non-Goals:**

- Persisting pending consolidations across process restarts (in-memory only)

## Decisions

- Store as `Map<string, PendingConsolidation & { createdAt: Date }>` on MemoryImpl
- `approveConsolidation` calls `ltm.consolidate(sourceIds, { data: summary, ... })`
- TTL purge runs at the start of `consolidate()` (cheap, no extra timer needed)

## Risks / Trade-offs

- [Risk] Pending map grows unboundedly if consolidate() is never called
  → TTL purge fires on every `consolidate()` call; warn log if map grows large
