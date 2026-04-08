## 1. Update applySupersedes return type

- [ ] 1.1 In `src/core/query-helpers.ts`, change `applySupersedes` to return `{ isSuperseded: boolean; supersedingIds: number[] }` instead of `boolean`
- [ ] 1.2 Collect `edge.fromId` values for all live supersedes edges and include in return value
- [ ] 1.3 Update all call sites of `applySupersedes` in `engine-ops.ts` and `top-up.ts` to destructure the new return type

## 2. Add queryVector to CollectResultsContext

- [ ] 2.1 In `src/core/engine-ops.ts`, add `queryVector: Float32Array` to `CollectResultsContext` interface
- [ ] 2.2 In `src/core/engine-ops.ts`, in the `collectContext` object literal inside `executeQuery`, add `queryVector: context.queryVector` — the wiring happens here, not in `ltm-engine.ts`

## 3. Add companion injection to collectQueryResults

- [ ] 3.1 After the main loop in `collectQueryResults`, collect a map of `supersededId → supersedingIds[]` from all results where `isSuperseded=true`
- [ ] 3.2 Build a set of record IDs already in the result set
- [ ] 3.3 For each superseding ID not already in the result set: call `const companion = findLiveRecord(id, storage)` (already exported from `query-helpers.ts`); if `companion` is undefined, skip — this handles both missing and tombstoned records correctly; otherwise use `companion` in the next step
- [ ] 3.4 Add `import { cosineSimilarity } from './cosine-similarity.js'` to `engine-ops.ts` (not currently imported there); compute `effectiveScore = cosineSimilarity(context.queryVector, companion.embedding) * retention(companion)` using the `companion` record captured in 3.3
- [ ] 3.5 Append companion as `LtmQueryResult` with `retrievalStrategies: ['companion']` and `isSuperseded: false`

## 4. Apply same injection to top-up

- [ ] 4.1 In `src/core/top-up.ts`, add `queryVector: Float32Array` to the `TopUpContext` interface (it has its own separate context type — not the same as `CollectResultsContext`); complete this before 4.2
- [ ] 4.2 In `src/core/engine-ops.ts`, update the `applyTopUp(...)` call in `executeQuery` to pass `queryVector: context.queryVector` into the top-up context (depends on 4.1 — TypeScript will error if 4.1 is not applied first)
- [ ] 4.3 Apply the same companion injection logic after the top-up loop in `applyTopUp`

## 5. Update LtmQueryResult type and fix stale casts

- [ ] 5.1 In `src/ltm-engine-types.ts`, add `'companion'` to the `retrievalStrategies` union: `('semantic' | 'temporal' | 'associative' | 'companion')[]`
- [ ] 5.2 In `src/core/engine-ops.ts` line ~162, update the hardcoded `as ('semantic' | 'temporal' | 'associative')[]` cast to include `'companion'`
- [ ] 5.3 In `src/core/top-up.ts` line ~43, update the same hardcoded cast to include `'companion'`

## 6. Verify

- [ ] 6.1 Run `pnpm run build` in `nuclei/ltm` — no type errors
- [ ] 6.2 Run `pnpm run test` in `nuclei/ltm` — all tests pass
- [ ] 6.3 Add a unit test for the companion injection: superseded result → companion appended, already-present companion not duplicated, one-hop cap enforced
