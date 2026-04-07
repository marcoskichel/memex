## Context

LTM has two entity-related gaps:

1. `insertConsolidatedRecord` (`consolidate-helpers.ts`) builds the semantic record's metadata as `{ confidence, preservedFacts, uncertainties, consolidatedAt, sourceIds }` — no `entities`. The source records passed in already carry `metadata.entities`, so the data is available but unused.

2. `filterCandidates` (`query-filters.ts`) hard-filters on `entityName`/`entityType` — records that don't match are excluded before RRF scoring. `rrfMerge` accepts `RankedCandidate[][]` (variadic lanes), so a 4th entity lane slots in without structural changes.

## Goals / Non-Goals

**Goals:**

- Semantic records produced by consolidation have `metadata.entities` populated (union of source entities, deduped by `name+type`)
- Entity match acts as a ranking signal, not a gate; non-entity records surface if semantically relevant
- No breaking change to `LtmQueryOptions`, `EntityMention`, or `StorageAdapter` interfaces

**Non-Goals:**

- Re-scoring or re-embedding semantic records after entity inheritance
- SQL-level entity indexing (entity filter remains in-memory)
- Auto-detecting entity names from free-text query strings (remains caller responsibility)

## Decisions

### Entity inheritance: union and deduplicate at storage time

In `insertConsolidatedRecord`, collect `metadata.entities` arrays from all `params.sources`, flatten, deduplicate by `name+type` pair, and include in the new record's metadata.

Deduplication key: `${entity.name}|${entity.type}`. After amygdala normalization ships, names are always lowercase, making this comparison exact and reliable.

Alternative: re-extract entities from the consolidated summary via LLM. Rejected — adds latency, cost, and an extra LLM call per consolidation; the source entities are already present and accurate.

### Entity RRF lane: soft boost, not hard filter

When `entityName` or `entityType` is present in `LtmQueryOptions`:

- Remove the entity condition from `filterCandidates` (candidates are no longer hard-excluded)
- After building semantic/temporal/associative ranked lists, compute an entity-ranked list: all candidates matching the entity filter, ranked by their semantic score descending
- Pass entity ranked list as the 4th argument to `rrfMerge`

This means entity-matching records get an additive RRF contribution on top of their semantic/temporal/associative scores. Non-entity records still score via the other three lanes.

Alternative: weight the entity lane differently (e.g., higher K value to dampen its contribution). Deferred — start with default K=60 (same as other lanes), tune if needed.

## Risks / Trade-offs

- [Entity union on large clusters] → Clusters are bounded by `minClusterSize` and `maxCreatedAtSpreadDays`; entity union is O(n) over a small list. Not a performance concern.
- [Backward compatibility: entity filter behavior change] → Callers using `entityName` as a strict filter (expecting no non-entity results) will see broader results. This is the intended improvement; no API signature changes.
- [No entity data on semantic records written before this change] → Entity-filtered queries will still miss old consolidated records. Acceptable — no backfill planned.
