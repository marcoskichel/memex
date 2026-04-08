## Why

Phase 2's `ltm` storage layer provides entity graph persistence but nothing populates it. A dedicated process needs to subscribe to LTM write events, extract entity mentions into structured nodes and relationship edges, and resolve identity — determining whether a newly observed entity already exists in the graph — before inserting.

## What Changes

- New `EntityExtractionProcess` class: subscribes to LTM write events, extracts entity nodes and relationship edges via LLM, runs the three-tier deduplication pipeline, and writes to the entity graph via `StorageAdapter`
- Three-tier deduplication pipeline:
  - Tier 1: Exact name match (normalized lowercase) — O(1), no embedding call
  - Tier 2: Type-first cosine similarity — entity type is checked before comparing embeddings; same type + cosine ≥ 0.85 = same entity (no LLM); different types = always distinct (no LLM)
  - Tier 3: LLM confirmation — only when same type AND cosine in [0.70, 0.85) ambiguous band
- Core pure functions: `extractEntitiesFromRecord`, `resolveEntityIdentity`, `buildEntityInsertPlan`
- Shell client: `EntityExtractionClient` wrapping LLM calls with `ResultAsync`

## Capabilities

### New Capabilities

- `entity-extraction-process`: the process lifecycle, LTM event subscription, entity extraction pipeline, and deduplication decision logic

### Modified Capabilities

(none — perirhinal is a new package with no existing specs)

## Impact

- New package `nuclei/perirhinal` (`@neurome/perirhinal`)
- Depends on `@neurome/ltm` (for `StorageAdapter`, `EntityNode`, `EntityEdge`, `LtmRecord`)
- Depends on `@neurome/llm` (for `completeStructured<T>`)
- Consumers wire `EntityExtractionProcess` into the pipeline alongside amygdala and hippocampus
