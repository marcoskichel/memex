## Why

Two gaps in LTM make entity context unreliable across the memory lifecycle. First, when the hippocampus consolidates episodic records into a semantic record, entity metadata is dropped — entity-filtered queries miss any fact that has been consolidated. Second, entity filtering is a hard filter that excludes non-entity-tagged records even when those records are highly semantically relevant.

## What Changes

- **Entity inheritance**: `insertConsolidatedRecord` unions entity mentions from all source episodic records and stores them on the consolidated semantic record's metadata
- **Entity RRF lane**: entity match is promoted from a hard filter in `filterCandidates` to a 4th RRF-ranked list in `executeQuery`, so entity-matching records are boosted without excluding non-entity results

## Capabilities

### New Capabilities

- `ltm-entity-inheritance`: Consolidated semantic records carry forward the union of entity mentions from their episodic sources

### Modified Capabilities

- `ltm-query`: Entity filter transitions from hard exclusion to soft boost (4th RRF lane); existing `entityName`/`entityType` query options remain but change semantics

## Impact

- `src/core/consolidate-helpers.ts` — `insertConsolidatedRecord` builds metadata with merged entities from sources
- `src/core/query-filters.ts` — `filterCandidates` no longer hard-filters on entity; entity matching is extracted to a separate function
- `src/core/engine-ops.ts` — `executeQuery` adds entity-ranked list, feeds it into `rrfMerge`
- `src/core/rrf-merge.ts` — may need a 4th lane parameter or the entity list uses the existing merge signature
