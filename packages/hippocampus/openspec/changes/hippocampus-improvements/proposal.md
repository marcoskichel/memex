## Why

`findConsolidationCandidates` clusters episodic records by cosine similarity only. Two episodes from six months apart can be consolidated together even if they represent genuinely distinct temporal contexts — destroying the primary value of episodic memory, which is temporal distinctness. Same-topic episodes from different time periods are not the same generalizable fact; they are different contexts.

## What Changes

- `FindConsolidationOptions` gains `maxCreatedAtSpreadDays?: number` (default: `30`)
- After clustering by embedding similarity, any cluster whose `max(createdAt) - min(createdAt)` exceeds the threshold is split at the largest consecutive time gap (sorted by `createdAt`)
- Each resulting sub-cluster is independently evaluated against `minClusterSize`; sub-clusters below minimum are discarded
- `HippocampusConfig` gains `maxCreatedAtSpreadDays?: number` so callers can configure the default at the process level
- Splitting happens before any LLM call — no wasted tokens on temporally-incoherent clusters

## Capabilities

### New Capabilities

_(none — this is a correctness constraint on an existing capability)_

### Modified Capabilities

- `hippocampus-consolidation`: temporal proximity constraint added to cluster evaluation

## Impact

- `packages/hippocampus`: `hippocampus-schema.ts` (`FindConsolidationOptions` type), `hippocampus-process.ts` (splitting logic in `consolidationPass`)
- No schema changes, no other packages affected
- Depends on `ltm-schema-extensions` being merged first
