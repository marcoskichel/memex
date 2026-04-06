## Why

When hippocampal consolidation produces a low-confidence summary (confidence < 0.5), the system emits a `hippocampus:false-memory-risk` event but inserts the record into LTM anyway. Real hippocampal consolidation is selective — distorted or uncertain gist should not be promoted as durable semantic memory. Inserting low-confidence summaries risks corrupting the semantic tier with hallucinated content.

## What Changes

- Consolidation results with `confidence < CONFIDENCE_THRESHOLD` SHALL NOT be inserted into LTM automatically.
- Instead, low-confidence consolidations SHALL be held in a pending state, queryable via `memory.getPendingConsolidations()`.
- `CONFIDENCE_THRESHOLD` defaults to `0.5` and is configurable via `HippocampusConfig`.
- A new `memory.approveConsolidation(id)` / `memory.discardConsolidation(id)` API allows callers to manually review and promote or discard pending records.
- The `hippocampus:false-memory-risk` event payload SHALL include the pending consolidation ID so consumers can act on it.
- If no consumer acts within a configurable TTL (`pendingConsolidationTtlMs`, default 24 hours), the pending record is discarded automatically.

## Capabilities

### New Capabilities

- `pending-consolidation-review`: Low-confidence consolidations are held for review rather than auto-inserted. Callers can approve or discard them.

### Modified Capabilities

- `hippocampus-process`: Consolidation pass checks confidence before inserting; emits enriched event payload including pending consolidation ID.

## Impact

- `packages/hippocampus/src/hippocampus-process.ts` — add confidence gate before LTM insertion
- `packages/hippocampus/src/hippocampus-schema.ts` — add `CONFIDENCE_THRESHOLD` constant, pending record type
- `packages/memory/src/memory-types.ts` — add `getPendingConsolidations()`, `approveConsolidation()`, `discardConsolidation()` to `Memory` interface
- `packages/memory/src/memory-impl.ts` — implement pending consolidation storage and review methods
- No changes to LTM schema required (pending records stored in-process until approved)
