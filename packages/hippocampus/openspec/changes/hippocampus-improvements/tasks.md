## Prerequisites

This change depends on `ltm-schema-extensions` being merged first. Do not begin implementation until that change is merged.

## Tasks

### Task 1: Add maxCreatedAtSpreadDays to FindConsolidationOptions and HippocampusConfig [x]

**File:** `packages/hippocampus/src/hippocampus-schema.ts`

- Add `maxCreatedAtSpreadDays?: number` to `FindConsolidationOptions` interface (if it does not exist — this type may live in `@neurokit/ltm`; if so, confirm before editing)
- If `FindConsolidationOptions` is defined in `hippocampus-schema.ts`, add the field there

**File:** `packages/hippocampus/src/hippocampus-process.ts`

- Add `maxCreatedAtSpreadDays?: number` to `HippocampusConfig`
- Add `DEFAULT_MAX_CREATED_AT_SPREAD_DAYS = 30` constant
- Store `this.maxCreatedAtSpreadDays` in the constructor from config with the default

**Tests:** Unit test that `HippocampusProcess` reads `maxCreatedAtSpreadDays` from config and uses the default when omitted.

---

### Task 2: Implement temporal cluster splitting in consolidationPass [x]

**File:** `packages/hippocampus/src/hippocampus-process.ts`

- Extract a private method `splitByTemporalProximity(cluster, maxSpreadDays)` that:
  1. Returns the cluster unchanged if `maxSpreadDays` is `undefined`
  2. Sorts records by `createdAt` ascending (sort a copy; do not mutate)
  3. Computes spread: `max(createdAt) - min(createdAt)` in days
  4. Returns `[cluster]` unchanged if spread <= `maxSpreadDays`
  5. Finds the index of the largest consecutive gap between sorted records
  6. Splits into `[sorted[0..splitIndex], sorted[splitIndex+1..end]]`
  7. Returns the two sub-clusters
- In `consolidationPass`, after receiving clusters from `findConsolidationCandidates`, for each cluster call `splitByTemporalProximity` with `this.maxCreatedAtSpreadDays`, then for each resulting sub-cluster apply the `minClusterSize` gate and proceed to LLM consolidation
- Pass `maxCreatedAtSpreadDays: this.maxCreatedAtSpreadDays` to `findConsolidationCandidates` options

**Tests:**

- Cohesive cluster (spread < threshold) is not split
- Dispersed cluster is split at the largest gap
- Sub-cluster below `minClusterSize` after split is discarded
- Sub-cluster above `minClusterSize` after split proceeds to LLM
- `maxCreatedAtSpreadDays: undefined` disables splitting entirely
- Split occurs at single largest gap only (not recursively)

---

### Task 3: Wire maxCreatedAtSpreadDays into findConsolidationCandidates call [x]

**File:** `packages/hippocampus/src/hippocampus-process.ts`

- Update the `findConsolidationCandidates` call in `consolidationPass` to include `maxCreatedAtSpreadDays: this.maxCreatedAtSpreadDays`
- Confirm whether `LtmEngine.findConsolidationCandidates` accepts this option; if not, the option is used only internally in hippocampus (splitting is done post-call) — in that case, do not forward it and note this in a code comment

**Tests:** Integration-style test that verifies end-to-end: given a dispersed cluster returned by a mock `findConsolidationCandidates`, `consolidationPass` correctly splits and gates sub-clusters before calling the LLM adapter.
