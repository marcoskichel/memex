## 1. Add PerirhinalStats type and enrich run() return

- [x] 1.1 Add `PerirhinalStats` interface to `src/core/types.ts`
- [x] 1.2 Update `processUnlinkedRecords` to accumulate and return stats
- [x] 1.3 Update `processRecord` to return per-record stats
- [x] 1.4 Update `executePlan` to return stats derived from `EntityInsertPlan` (toInsert.length → entitiesInserted, toReuse.length → entitiesReused)
- [x] 1.5 Update `run()` signature to `ResultAsync<PerirhinalStats, ExtractionError>`

## 2. Exports

- [x] 2.1 Export `PerirhinalStats` and `EntityExtractionProcess` from `src/index.ts`

## 3. Tests

- [x] 3.1 Update existing `entity-extraction-process.test.ts` assertions to check returned stats shape
- [x] 3.2 Add test: run with no unlinked records returns stats with all zeros
- [x] 3.3 Add test: run with mixed insert/reuse records returns correct counts
