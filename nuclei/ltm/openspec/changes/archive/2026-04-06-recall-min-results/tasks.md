## 1. Type Change

- [ ] 1.1 Add `minResults?: number` to `LtmQueryOptions` in `src/ltm-engine-types.ts`

## 2. Query Context

- [ ] 2.1 Add `minResults: number` to `QueryContext` in `src/ltm-engine.ts`
- [ ] 2.2 Pass `queryOptions?.minResults ?? 0` into the context when calling `executeQuery`

## 3. Top-up Logic

- [ ] 3.1 In `src/core/engine-ops.ts`, after `collectQueryResults` returns, implement a top-up pass: filter excluded candidates to those with cosine similarity > 0.05, sort by effectiveScore descending, append until `results.length >= minResults`
- [ ] 3.2 Ensure top-up records are excluded from the `strengthenResults` call

## 4. Tests

- [ ] 4.1 Add test: open query with no threshold-passing records returns `minResults` records when eligible candidates exist
- [ ] 4.2 Add test: `minResults: 0` (default) preserves existing empty-result behaviour
- [ ] 4.3 Add test: top-up skipped when only candidates have cosine similarity <= 0.05
- [ ] 4.4 Add test: threshold-passing records are not displaced by top-up records
- [ ] 4.5 Run `pnpm check` in `packages/ltm`, fix any lint/type errors
