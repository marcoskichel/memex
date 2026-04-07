## 1. Entity Inheritance in Consolidation

- [x] 1.1 In `consolidate-helpers.ts`, add a helper that collects `metadata.entities` from all source records, flattens the arrays, and deduplicates by `name+type` key
- [x] 1.2 Pass the deduplicated entity array into `insertConsolidatedRecord`'s metadata object alongside `confidence`, `preservedFacts`, `uncertainties`, `consolidatedAt`, and `sourceIds`
- [x] 1.3 Add unit tests in `ltm-engine.test.ts` covering: entity union from two sources, deduplication of identical entities, no entity key when sources have none, entity-filtered query finds consolidated record

## 2. Entity RRF Lane

- [x] 2.1 Remove entity condition (`entityName` / `entityType`) from the hard-filter block in `filterCandidates` (`query-filters.ts`)
- [x] 2.2 Add `buildEntityRankedList(candidates, options)` in `query-filters.ts` that returns a `RankedCandidate[]` of entity-matching records ranked by semantic score descending; returns `[]` when no entity filter is present
- [x] 2.3 In `executeQuery` (`engine-ops.ts`), call `buildEntityRankedList` after building the three existing ranked lists and pass it as the 4th lane to `rrfMerge`
- [x] 2.4 Add unit tests covering: entity-matching record scores higher than non-matching with same semantic similarity, non-entity records still appear in results, no entity filter leaves behaviour unchanged

## 3. Verification

- [x] 3.1 Run the full ltm test suite and confirm all existing tests pass
- [x] 3.2 Confirm query tests that previously relied on entity hard-filter exclusion are updated to reflect soft-boost semantics
