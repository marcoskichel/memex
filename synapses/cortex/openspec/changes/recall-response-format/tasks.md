## 1. LTM Prerequisite — Expose supersedingIds

- [x] 1.1 Add `supersedingIds: number[]` to `MemoryRecallResult` type in `nuclei/ltm/src/ltm-engine-types.ts`
- [x] 1.2 Forward `supersedingIds` from `applySupersedes` result into the query result construction in `nuclei/ltm/src/core/engine-ops.ts`
- [x] 1.3 Update LTM unit tests to assert `supersedingIds` is populated on superseded records

## 2. Protocol Types

- [x] 2.1 Define `MemoryEntry`, `MemoryChange`, and `RecallResult` types in `nuclei/cortex-ipc/src/protocol.ts`
- [x] 2.2 Update the recall IPC response type to use `RecallResult[]`

## 3. Serialization Layer

- [x] 3.1 Implement `serializeRecallResults(results: MemoryRecallResult[]): RecallResult[]` in `synapses/cortex/src/ipc/handlers.ts`
  - Strip internal fields (`rrfScore`, `embeddingMeta`, `accessCount`, `tombstoned`, `stability`, `episodeSummary`, `insightId`, `engramId` from metadata)
  - Filter hash-format tags (64-char hex strings)
  - Bucket `effectiveScore` → `relevance`
  - Rename `data` → `memory`, `createdAt` → `recordedAt` (day precision)
- [x] 3.2 Implement companion grouping: pair superseded records with their companion using `supersedingIds`
- [x] 3.3 Handle edge case: superseded record with no companion in result set (emit with `superseded: true`)
- [x] 3.4 Replace the inline serialization in `recallMemory` with `serializeRecallResults`

## 4. Tests

- [x] 4.1 Unit test `serializeRecallResults` — normal record → `MemoryEntry` with correct fields stripped
- [x] 4.2 Unit test hash tag filtering — mixed tags array → only semantic tags retained
- [x] 4.3 Unit test relevance bucketing — scores at 0.7, 0.5, 0.43 boundaries
- [x] 4.4 Unit test companion grouping — superseded + companion → single `MemoryChange`
- [x] 4.5 Unit test orphaned superseded record → standalone `MemoryEntry` with `superseded: true`
- [x] 4.6 Unit test multiple companions — first matching companion used

## 5. Validation

- [x] 5.1 Run full test suite (`yarn test`) — all green
- [ ] 5.2 Run e2e recall script against a live cortex instance and verify output shape matches spec
