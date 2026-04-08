## Context

`applySupersedes` currently returns `boolean`. It already calls `storage.edgesTo(recordId)`
to find incoming supersedes edges. The proposed companion injection needs those same edge
`fromId` values — but today they're discarded after setting the boolean. The key
performance insight: companion injection requires zero additional `edgesTo` calls if
`applySupersedes` returns the superseding IDs it already has.

Companion records' `effectiveScore` requires `cosineSimilarity(queryVector, companion.embedding)`.
The query vector is not currently in `CollectResultsContext` — it needs to be added.
This is a CPU-only dot product, no model call.

## Goals / Non-Goals

**Goals:**

- Ensure the superseding record is always returned alongside a superseded one
- Keep performance overhead negligible (no model calls, at most N×1 `getById` lookups)
- Prevent cascade (A superseded by B superseded by C → only B injected, not C)

**Non-Goals:**

- Changing how `isSuperseded` is computed
- Changing the score ranking of existing results (companions are appended, not re-ranked)
- Injecting companions when the superseding record is already in the result set

## Decisions

**Return `{ isSuperseded, supersedingIds[] }` from `applySupersedes`:**
The caller already has the edges from `edgesTo`. Returning the IDs costs nothing and
eliminates a second `edgesTo` call during companion injection.

**Companion injection placement — after `collectQueryResults` main loop:**
After all main results are collected, do a single pass: for each result where
`isSuperseded=true`, fetch superseding records by ID (`storage.getById`), compute their
`effectiveScore`, and inject those not already in the result set.

**Companions have `isSuperseded: false`:**
The injected record is the correction — it supersedes others, it is not itself superseded
(within one hop). `isSuperseded` on companions is always `false`.

**`retrievalStrategies: ['companion']`:**
The consumer (agent prompt layer) can use this to annotate or label the companion record
differently (e.g. "correction:") without changing result ranking logic.

**One-hop cap:**
After injecting companions, do NOT call `applySupersedes` on them. If B is itself
superseded by C, C will not be injected unless it appeared in the main result set
independently. This keeps the logic O(N) and predictable.

**`top-up.ts` gets the same treatment:**
Top-up results go through the same `applySupersedes` call and should also inject
companions for consistency.

## Risks / Trade-offs

- [Risk] Result count may exceed the requested `limit` when companions are injected →
  Mitigation: document in spec that companions can exceed limit; the agent already handles
  variable result counts
- [Risk] A companion record is tombstoned or missing → Mitigation: skip missing/tombstoned
  companions silently (guard with null check before injection)
- [Risk] `queryVector` added to `CollectResultsContext` changes the interface → Mitigation:
  the context type is internal; no external API change
