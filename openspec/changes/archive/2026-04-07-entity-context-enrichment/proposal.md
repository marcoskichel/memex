# entity-context-enrichment

## What

Three coordinated improvements to how Neurome builds and retrieves entity context across the memory pipeline:

1. **Entity normalization** — amygdala extracts entity names consistently (canonical/most-complete form) and stores them lowercase, eliminating case and alias drift across observations.
2. **Entity inheritance** — hippocampus consolidation carries entity metadata forward from episodic sources to the resulting semantic record, so entity-filtered queries still work after consolidation.
3. **Entity-centric recall** — entity matches act as a soft boost (4th RRF lane) rather than a hard filter, so entity-matching records surface reliably without excluding non-entity results.

## Why

Entity data is extracted per-observation but currently lost at consolidation boundaries and inconsistently represented across records. This means:

- `recall('Alice')` with `entityName: 'alice'` misses any memory about Alice that has been consolidated into a semantic record.
- "Alice", "alice", and "Alice Smith" stored as distinct entities fragment the entity index.
- Hard entity filtering excludes relevant memories that didn't happen to tag the entity.

## Scopes

- `amygdala` — normalization: system prompt + `parseEntities` post-processing
- `ltm` — entity inheritance in `insertConsolidatedRecord`; entity RRF lane in `executeQuery`

## Shared Contract

Entity shape is unchanged: `{ name: string, type: EntityType }`. After this change, `name` is always lowercase. Callers passing `entityName` to `LtmQueryOptions` should already be lowercasing (query-side already does `toLowerCase()`), so no breaking change.

## Coordination Note

`amygdala` change ships first (or simultaneously). `ltm` inheritance and RRF changes are independent of each other but both depend on normalized entity names being written by amygdala.
