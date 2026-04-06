## ADDED Requirements

### Requirement: Effective score computation

The engine SHALL compute each candidate record's `effectiveScore` as `cosineSimilarity(queryEmbedding, recordEmbedding) × retention` where `retention` is computed at query time using the decay formula.

#### Scenario: High similarity and high retention yields high score

- **WHEN** a record has cosine similarity 0.9 and retention 0.95
- **THEN** its `effectiveScore` is approximately 0.855

#### Scenario: High similarity but low retention yields reduced score

- **WHEN** a record has cosine similarity 0.9 and retention 0.2
- **THEN** its `effectiveScore` is approximately 0.18

### Requirement: Threshold filtering

The engine SHALL exclude records with `effectiveScore` below a configurable threshold. The default threshold SHALL be `0.5`.

#### Scenario: Records below threshold are excluded

- **WHEN** `query(nlQuery)` is called with default threshold
- **THEN** no result has `effectiveScore < 0.5`

#### Scenario: Custom threshold is respected

- **WHEN** `query(nlQuery, { threshold: 0.2 })` is called
- **THEN** records with `effectiveScore >= 0.2` are returned

### Requirement: Results sorted by effective score

Results SHALL be returned sorted by `effectiveScore` descending.

#### Scenario: Top result has highest effective score

- **WHEN** `query(...)` returns multiple results
- **THEN** the first result has the highest `effectiveScore` of all results

### Requirement: Superseded record tagging

For each result, the engine SHALL load its incoming `supersedes` edges. If such an edge exists (another record supersedes this one) AND the edge's retention is above `0.3`, the result SHALL have `superseded: true` set. If the edge retention is `≤ 0.3`, neither record SHALL be tagged — both SHALL be returned as equally valid.

#### Scenario: Recently superseded record is tagged

- **WHEN** record A supersedes record B and the supersedes edge has retention 0.8
- **THEN** record B is returned with `superseded: true`

#### Scenario: Faded supersedes edge removes tag

- **WHEN** record A supersedes record B and the supersedes edge has retention 0.2
- **THEN** both record A and record B are returned without `superseded: true`

### Requirement: Graduated retrieval strengthening

When `strengthen: true` (the default), the engine SHALL grow each returned record's stability. The top result SHALL receive the full growth factor. Lower results SHALL receive growth scaled by `record.effectiveScore / topResult.effectiveScore`.

#### Scenario: Top result receives full growth

- **WHEN** `query(...)` returns results and `strengthen` is true
- **THEN** the record with the highest `effectiveScore` has its stability grown by the full `growthFactor`

#### Scenario: Lower results receive proportional growth

- **WHEN** a result's `effectiveScore` is half of the top result's
- **THEN** its stability grows by half the growth factor of the top result

### Requirement: Edge strengthening on query

When `strengthen: true`, all relationship edges traversed while evaluating superseded status SHALL also have their stability grown using the same spacing-effect formula applied to the edge's current retention.

#### Scenario: Traversed edges are strengthened

- **WHEN** a query traverses a `supersedes` edge to evaluate tagging
- **THEN** that edge's `stability` and `lastAccessedAt` are updated

### Requirement: No-strengthen mode

When `query(nlQuery, { strengthen: false })` is called, the engine SHALL return results without updating any `stability`, `lastAccessedAt`, or `accessCount` values.

#### Scenario: Strengthen false causes no side effects

- **WHEN** `query(nlQuery, { strengthen: false })` is called
- **THEN** no record or edge has its stability, lastAccessedAt, or accessCount modified

### Requirement: Structured filters

The engine SHALL support optional structured filters on `query()`: `tier` ('episodic' | 'semantic'), `minImportance` (number), `after` (Date), `before` (Date), `minStability` (number), and `minAccessCount` (number). Records not matching all provided filters SHALL be excluded before scoring.

#### Scenario: Tier filter excludes wrong tier

- **WHEN** `query(nlQuery, { tier: 'semantic' })` is called
- **THEN** no episodic records appear in results

#### Scenario: minImportance filter is applied

- **WHEN** `query(nlQuery, { minImportance: 0.7 })` is called
- **THEN** only records with `importance >= 0.7` are candidates

#### Scenario: after/before filter restricts by createdAt

- **WHEN** `query(nlQuery, { after: someDate })` is called
- **THEN** only records created after `someDate` are candidates

### Requirement: Sort options

The engine SHALL support a `sort` option on `query()` with values `'confidence'` (default, sorts by effectiveScore), `'recency'` (sorts by `lastAccessedAt` descending), `'stability'` (sorts by stability descending), and `'importance'` (sorts by importance descending).

#### Scenario: Recency sort returns most recently accessed first

- **WHEN** `query(nlQuery, { sort: 'recency' })` is called
- **THEN** results are ordered by `lastAccessedAt` descending

### Requirement: Result count limit

The engine SHALL support a `limit` option that caps the number of returned results. When omitted, all results above the threshold are returned.

#### Scenario: Limit caps result count

- **WHEN** `query(nlQuery, { limit: 3 })` is called and 10 records match
- **THEN** exactly 3 results are returned

### Requirement: Query embeds via injected EmbeddingAdapter

`queryLtm` SHALL embed the query string using the injected `EmbeddingAdapter`. It SHALL NOT compute embeddings internally. The embedding adapter is injected at engine construction time.

#### Scenario: Embedding is produced via the injected adapter

- **WHEN** `query(nlQuery)` is called
- **THEN** `embeddingAdapter.embed(nlQuery)` is called exactly once

### Requirement: Three-strategy RRF retrieval pipeline

`queryLtm` SHALL run three retrieval strategies in parallel and merge results with Reciprocal Rank Fusion (RRF, K=60): (1) semantic cosine, (2) temporal-weighted cosine (cosine × retention), and (3) one-hop associative graph traversal following `elaborates`, `supersedes`, and `consolidates` edges from top semantic hits.

#### Scenario: Semantic strategy scores by cosine similarity

- **WHEN** query runs
- **THEN** each record receives a cosine similarity score against the query embedding

#### Scenario: Temporal strategy weights by retention

- **WHEN** query runs
- **THEN** each record also receives a temporal-weighted score of `cosineSimilarity × retention`

#### Scenario: Associative strategy follows outbound edges

- **WHEN** a top semantic hit has outbound `elaborates` edges
- **THEN** the connected records are added to the candidate pool with discounted scores

#### Scenario: contradicts edges surface both records

- **WHEN** a candidate has a `contradicts` edge to another record
- **THEN** both records appear in results and are marked for caller resolution

#### Scenario: RRF merges all strategy lists

- **WHEN** all three strategies produce ranked lists
- **THEN** the final order is determined by RRF with K=60; records present in multiple lists rank higher

### Requirement: Embedding model mismatch detection

Before executing a query, `queryLtm` SHALL compare `adapter.modelId` against the stored `embeddingMeta.modelId` of the first record. On mismatch, it SHALL return a `EMBEDDING_MODEL_MISMATCH` error immediately without scoring any records.

#### Scenario: Query fails fast on model mismatch

- **WHEN** records were embedded with model A and the injected adapter has model B
- **THEN** `query()` returns an `EMBEDDING_MODEL_MISMATCH` error before computing any scores

#### Scenario: Query proceeds when models match

- **WHEN** the injected adapter modelId matches stored embeddingMeta.modelId
- **THEN** query proceeds normally

### Requirement: Graduated strengthening with graph discount

When `strengthen: true`, the engine SHALL apply full growth factor to the top result, proportional growth to lower results, and 50% of the growth factor of direct semantic hits to records added via graph traversal.

#### Scenario: Graph-traversal records get half growth factor

- **WHEN** a record enters results via associative graph traversal
- **THEN** its stability growth is 50% of the growth factor applied to the direct semantic hit that led to it

### Requirement: LtmQueryResult includes RRF score and retrieval strategies

`LtmQueryResult` SHALL include `rrfScore: number` (the RRF-merged score) and `retrievalStrategies: ('semantic' | 'temporal' | 'associative')[]` listing which strategies contributed to this result.

#### Scenario: Result from multiple strategies lists all of them

- **WHEN** a record appears in both semantic and temporal strategy outputs
- **THEN** its `retrievalStrategies` includes both `'semantic'` and `'temporal'`

### Requirement: Confidence promoted to query result

For records with `tier === 'semantic'`, `LtmQueryResult` SHALL include `confidence?: number` promoted from `metadata.confidence`.

#### Scenario: Semantic record result includes confidence

- **WHEN** `query()` returns a semantic record
- **THEN** the result's `confidence` field equals the value stored in that record's `metadata.confidence`

#### Scenario: Episodic record result has no confidence field

- **WHEN** `query()` returns an episodic record
- **THEN** the result's `confidence` field is undefined

### Requirement: Lazy decay threshold event emission

`query()` SHALL emit `ltm:record:decayed-below-threshold` lazily when a record's computed retention crosses below `0.2` during score computation. The event SHALL NOT be emitted via a polling loop.

#### Scenario: Event emitted when retention crosses 0.2 during query

- **WHEN** `query()` computes retention for a record and the result is below 0.2 for the first time
- **THEN** `ltm:record:decayed-below-threshold` is emitted with the record's id, retention, stability, and lastAccessedAt

#### Scenario: Event not emitted for records above threshold

- **WHEN** `query()` runs and a record's retention is 0.5
- **THEN** no `ltm:record:decayed-below-threshold` event is emitted for that record
