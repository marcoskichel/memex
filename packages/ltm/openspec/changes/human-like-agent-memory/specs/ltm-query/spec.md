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
