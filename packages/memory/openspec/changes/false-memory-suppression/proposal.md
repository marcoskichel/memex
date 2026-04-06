## Why

Low-confidence hippocampal consolidations are inserted into LTM even when the system flags them as false-memory risks. The `Memory` interface needs methods to surface pending consolidations awaiting review, and to allow callers to approve or discard them.

## What Changes

- `Memory` interface SHALL expose three new methods:
  - `getPendingConsolidations(): PendingConsolidation[]` — returns all consolidation results awaiting review.
  - `approveConsolidation(id: string): Promise<number>` — inserts the pending record into LTM and returns its new record ID.
  - `discardConsolidation(id: string): void` — drops the pending record permanently.
- `PendingConsolidation` type SHALL be exported from `@memex/memory`.
- `MemoryImpl` SHALL maintain an in-memory map of pending consolidations, populated when the hippocampus emits a `hippocampus:false-memory-risk` event carrying a pending record.
- Pending consolidations older than `pendingConsolidationTtlMs` (default 24 hours, configurable in `MemoryConfig`) SHALL be auto-discarded on the next consolidation cycle.

## Capabilities

### New Capabilities

- `pending-consolidation-review`: SDK consumers can inspect, approve, or discard low-confidence consolidations before they enter LTM.

### Modified Capabilities

- (none — new interface methods, additive)

## Impact

- `packages/memory/src/memory-types.ts` — add `PendingConsolidation` type, add three methods to `Memory` interface, add `pendingConsolidationTtlMs` to `MemoryConfig`
- `packages/memory/src/memory-impl.ts` — maintain `pendingConsolidations` map; listen to `hippocampus:false-memory-risk`; implement all three methods; auto-discard on TTL
