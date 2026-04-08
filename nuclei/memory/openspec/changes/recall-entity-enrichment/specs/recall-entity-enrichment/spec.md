## ADDED Requirements

### Requirement: Enrichment is triggered by caller-supplied current position

When `recall()` is called with `currentEntityIds` or `currentEntityHint`, `MemoryImpl` SHALL enrich the top-3 results (by rank) with an `entityContext` field. When neither field is present, `entityContext` SHALL be absent on all results.

#### Scenario: currentEntityIds triggers enrichment on top results

- **WHEN** `recall(query, { currentEntityIds: [42] })` is called
- **THEN** the top-3 results include a non-undefined `entityContext` field

#### Scenario: no position fields — enrichment absent

- **WHEN** `recall(query)` is called with no `currentEntityIds` or `currentEntityHint`
- **THEN** no result has an `entityContext` field

### Requirement: currentEntityHint strings are each resolved to entities via embedding at query time

`MemoryImpl` SHALL embed each string in `currentEntityHint` using its `EmbeddingAdapter`, then call `storage.findEntityByEmbedding(embedding, ENTITY_HINT_SIMILARITY_THRESHOLD)` for each. All resolved entities across all hints become BFS seeds (duplicates deduplicated by entity ID).

#### Scenario: one hint resolves to matching entities — enrichment proceeds

- **WHEN** `currentEntityHint` contains one string and at least one entity exceeds the similarity threshold
- **THEN** enrichment proceeds using the resolved entities as BFS seeds

#### Scenario: multiple hints each contribute entities

- **WHEN** `currentEntityHint: ['settings screen', 'profile page']` is provided and both resolve above threshold
- **THEN** entities from both hints are merged (deduplicated) and used as BFS seeds

#### Scenario: all hints resolve to no entities above threshold — enrichment silently skipped

- **WHEN** `currentEntityHint` is provided but no hint resolves any entity above `ENTITY_HINT_SIMILARITY_THRESHOLD`
- **THEN** `entityContext` is absent on all results (graceful degrade, no error thrown)

### Requirement: Enrichment resolves linked entities for each top result

For each of the top-3 results, `MemoryImpl` SHALL look up entities linked to the record via `entity_record_links`. If a record has no linked entities, its `entityContext` SHALL be absent.

#### Scenario: record with linked entities receives entityContext

- **WHEN** a top result's record has one or more linked entities
- **THEN** `entityContext.entities` contains those entities and `entityContext.entityResolved` is `true`

#### Scenario: record with no linked entities receives no entityContext

- **WHEN** a top result's record has no linked entities
- **THEN** `entityContext` is absent for that result

### Requirement: selectedEntity is the linked entity with highest cosine similarity to the recall query

`MemoryImpl` SHALL compute cosine similarity between each linked entity's embedding and the recall query embedding, and set `entityContext.selectedEntity` to the entity with the highest score. Ties SHALL be broken by stable array-index order from `entity_record_links`.

#### Scenario: single linked entity — trivially selected

- **WHEN** a record has exactly one linked entity
- **THEN** `entityContext.selectedEntity` is that entity

#### Scenario: multiple linked entities — highest-similarity entity selected

- **WHEN** a record has multiple linked entities with distinct cosine similarities to the query
- **THEN** `entityContext.selectedEntity` is the entity with the highest similarity score

### Requirement: Multi-source BFS finds shortest path from any current-position entity to selectedEntity

`MemoryImpl` SHALL run BFS seeded simultaneously from all current-position entities (from `currentEntityIds` or resolved from `currentEntityHint`). The result SHALL be the shortest path found from any seed to `selectedEntity`. `entityContext.originEntity` SHALL identify the seed that produced the winning path.

#### Scenario: single seed — standard BFS

- **WHEN** `currentEntityIds: [seedId]` and a path exists to `selectedEntity`
- **THEN** `navigationPath` contains the ordered steps from `seedId` to `selectedEntity`, and `originEntity` is the entity for `seedId`

#### Scenario: multiple seeds — shortest path wins

- **WHEN** two seeds are provided and one produces a shorter path than the other
- **THEN** `navigationPath` contains the shorter path and `originEntity` is the winning seed's entity

#### Scenario: no path from any seed — navigationPath is undefined

- **WHEN** no directed path exists from any seed to `selectedEntity` within `maxHops`
- **THEN** `entityContext.navigationPath` is `undefined` and `entityContext.originEntity` is `undefined`

### Requirement: Path reliability is classified post-BFS using a 5-hop threshold

After BFS completes, `MemoryImpl` SHALL set `pathReliability`:

- `'ok'` when `navigationPath.length - 1 <= ENTITY_PATH_RELIABILITY_THRESHOLD` (i.e., ≤ 5 hops)
- `'degraded'` when the path exceeds the threshold

BFS SHALL always run at `maxHops = 10`. The 5-hop threshold is a reliability signal, not a search cutoff.

#### Scenario: path within 5 hops — reliability ok

- **WHEN** `navigationPath` has 3 steps (2 hops)
- **THEN** `pathReliability` is `'ok'`

#### Scenario: path exceeding 5 hops — reliability degraded

- **WHEN** `navigationPath` has 8 steps (7 hops)
- **THEN** `pathReliability` is `'degraded'`

### Requirement: Top-3 enrichment runs in parallel

`MemoryImpl` SHALL resolve entity links and run BFS for the top-3 results concurrently (e.g., via `Promise.all`). Results SHALL be attached to each `RecallResult` in rank order.

#### Scenario: enrichment does not serialise over results

- **WHEN** enrichment is requested for 3 results
- **THEN** all three entity-context lookups are initiated before any awaited, not sequentially one-by-one
