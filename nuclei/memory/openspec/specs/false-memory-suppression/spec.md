## pending-consolidation-review (memory)

`Memory` interface SHALL expose:

- `getPendingConsolidations(): PendingConsolidation[]`
- `approveConsolidation(pendingId: string): ResultAsync<number, InsertMemoryError>`
- `discardConsolidation(pendingId: string): void`

`PendingConsolidation` SHALL be exported from `@memex/memory`.

`MemoryImpl` SHALL maintain a `Map<string, PendingConsolidation>` populated when
`hippocampus:false-memory-risk` fires.

Pending entries older than `pendingConsolidationTtlMs` (default 24 hours) SHALL be
auto-discarded at the start of each `consolidate()` call.

`MemoryConfig` SHALL accept optional `pendingConsolidationTtlMs?: number`.
