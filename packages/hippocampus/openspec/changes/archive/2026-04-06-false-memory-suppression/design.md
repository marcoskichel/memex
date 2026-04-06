## Context

`consolidationPass()` currently calls `ltm.consolidate()` first, then emits
`hippocampus:false-memory-risk` with `recordId` after the fact. The record is
already in LTM by the time the event fires — there's nothing to suppress.

## Goals / Non-Goals

**Goals:**

- Gate LTM insertion on `confidence >= LOW_CONFIDENCE_THRESHOLD`
- Emit `hippocampus:false-memory-risk` BEFORE insertion with full pending data

**Non-Goals:**

- Persistent pending storage (memory-scope concern)
- TTL auto-discard (memory-scope concern)

## Decisions

- Move the confidence check BEFORE `ltm.consolidate()`; emit event then `continue`
- Event payload changes: drops `recordId`, adds `pendingId`, `summary`, `preservedFacts`, `uncertainties`
- `pendingId` is a UUID generated in hippocampus and passed to memory via the event

## Risks / Trade-offs

- [Risk] Existing consumers of `hippocampus:false-memory-risk` depend on `recordId`
  → Breaking change to event payload shape — update `memory-events.ts` accordingly
