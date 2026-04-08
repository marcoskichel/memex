## Why

When a superseded record scores higher than the record that supersedes it, the agent
receives a confidently-ranked wrong answer with no visibility that a correction exists.
The superseding record only appears in results if it independently ranked above threshold —
which often it does not (it may be newer and less accessed). The agent needs to always
see the correction alongside the outdated answer.

## What Changes

- After the main query pipeline, inject "companion" records: for each result where
  `isSuperseded=true`, load the superseding record(s) and add them to the result set if
  not already present
- Mark injected companions with a new `'companion'` retrieval strategy
- Companion injection is capped at one hop (companions are not themselves checked for
  supersession) to prevent cascading
- `applySupersedes` return type changes from `boolean` to `{ isSuperseded: boolean; supersedingIds: number[] }`
  to avoid a second `edgesTo` call per result
- `queryVector` is added to `CollectResultsContext` so companion cosine similarity can
  be computed without a model call

## Capabilities

### New Capabilities

- `superseded-companion-recall`: when a superseded record is recalled, its superseding
  companion is always included in the result set

### Modified Capabilities

- `ltm-query`: result set may include companion records beyond the requested limit when
  superseded records are present

## Impact

- `src/core/query-helpers.ts` — `applySupersedes` return type change
- `src/core/engine-ops.ts` — companion injection step, `queryVector` in context
- `src/core/top-up.ts` — same companion injection
- `src/ltm-engine-types.ts` — add `'companion'` to `retrievalStrategies` union
- `src/ltm-engine.ts` — pass `queryVector` into `CollectResultsContext`
