## Why

`LtmEngine.query` filters results by `effectiveScore = sim × retention >= threshold`. For open/broad queries, cosine similarity is diffuse and the product falls below 0.5 even for genuinely relevant records, producing empty results. A `minResults` guarantee ensures callers always receive something to work with.

## What Changes

- Add `minResults?: number` to `LtmQueryOptions`.
- After threshold filtering, if `results.length < minResults`, top up from excluded candidates sorted by `effectiveScore` descending, skipping any record with raw cosine similarity below a minimum floor (0.05) to exclude truly orthogonal records.
- Top-up records are appended after threshold-passing records in the result list.
- Default `minResults` is `0` (no change to existing behaviour when not specified).

## Capabilities

### New Capabilities

### Modified Capabilities

- `ltm-query`: `LtmQueryOptions` gains `minResults?: number`. Query execution gains a top-up pass.

## Impact

- `packages/ltm/src/ltm-engine-types.ts` — add `minResults` field
- `packages/ltm/src/ltm-engine.ts` — pass `minResults` into query context
- `packages/ltm/src/core/engine-ops.ts` — implement top-up pass after `collectQueryResults`
