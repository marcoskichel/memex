## MODIFIED Requirements

### Requirement: LtmQueryOptions supports sessionId and category filters

`LtmQueryOptions` SHALL accept `sessionId?: string`, `category?: string`, `entityName?: string`, and `entityType?: EntityType`. All filters, when present, SHALL be applied as SQL WHERE clauses before records are loaded into memory for embedding scoring. Filters are AND-combined when multiple are supplied.

#### Scenario: sessionId filter applied before scoring

- **WHEN** `ltm.query('topic', { sessionId: 'abc' })` is called with 10,000 records across 100 sessions
- **THEN** only records with `session_id = 'abc'` are scored; no cross-session records appear in results

#### Scenario: category filter applied before scoring

- **WHEN** `ltm.query('topic', { category: 'user_preference' })` is called
- **THEN** only records with `category = 'user_preference'` are scored

#### Scenario: Both filters AND-combined

- **WHEN** `ltm.query('topic', { sessionId: 'abc', category: 'user_preference' })` is called
- **THEN** only records matching both session and category are scored

#### Scenario: No filters returns all records as candidates

- **WHEN** `ltm.query('topic')` is called without sessionId or category
- **THEN** all records regardless of session or category are candidates (existing behaviour)

#### Scenario: entityName filter returns only records mentioning that entity

- **WHEN** `ltm.query('preferences', { entityName: 'marcos' })` is called
- **THEN** only records whose `metadata.entities` contains an entry with `name` matching 'marcos' (case-insensitive) are candidates

#### Scenario: entityType filter returns only records with that entity type

- **WHEN** `ltm.query('tools', { entityType: 'tool' })` is called
- **THEN** only records whose `metadata.entities` contains at least one entry with `type === 'tool'` are candidates

#### Scenario: entityName and entityType combined

- **WHEN** `ltm.query('query', { entityName: 'typescript', entityType: 'tool' })` is called
- **THEN** only records with a matching entity entry satisfying both name and type are candidates

#### Scenario: Records without metadata.entities are excluded when entity filter is active

- **WHEN** an entity filter is applied and some records have no `metadata.entities`
- **THEN** those records are excluded from candidates

## ADDED Requirements

### Requirement: minResults guarantees a minimum number of results

`LtmQueryOptions` SHALL accept `minResults?: number` (default `0`). After threshold filtering, if the number of results is less than `minResults`, the engine SHALL top up with the highest-scoring excluded candidates whose raw cosine similarity exceeds `0.05`, until `results.length >= minResults` or no eligible candidates remain. Top-up records are appended after threshold-passing records, ordered by `effectiveScore` descending. Top-up records are NOT strengthened.

#### Scenario: Open query with no threshold-passing results returns minResults records

- **WHEN** `ltm.query('what have I been working on', { minResults: 1 })` is called and no record has `effectiveScore >= threshold`
- **THEN** the single highest-scoring candidate with cosine similarity > 0.05 is returned

#### Scenario: Threshold-passing results are not affected by minResults

- **WHEN** `ltm.query('specific topic', { minResults: 1 })` is called and 3 records pass the threshold
- **THEN** all 3 threshold-passing records are returned; no top-up is performed

#### Scenario: minResults of 0 preserves existing behaviour

- **WHEN** `ltm.query('topic')` is called without minResults (defaulting to 0)
- **THEN** only records with effectiveScore >= threshold are returned, same as before

#### Scenario: Top-up excluded for near-zero cosine similarity

- **WHEN** top-up is triggered and the only excluded candidate has cosine similarity <= 0.05
- **THEN** no top-up record is added; results may still be empty

#### Scenario: Top-up records rank below threshold-passing records

- **WHEN** top-up is triggered alongside 2 threshold-passing records
- **THEN** the result list contains threshold records first, top-up records after
