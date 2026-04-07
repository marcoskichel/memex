## MODIFIED Requirements

### Requirement: LtmQueryOptions supports sessionId and category filters

`LtmQueryOptions` SHALL accept `sessionId?: string`, `category?: string`, `entityName?: string`, and `entityType?: EntityType`. `sessionId`, `category`, `tags`, `tier`, `minImportance`, `after`, `before`, `minStability`, and `minAccessCount` filters SHALL be applied as hard filters in `filterCandidates` before records enter the scoring phase. `entityName` and `entityType` SHALL NOT be applied as hard filters; instead they contribute a soft entity-ranked lane to RRF scoring (see Requirement: Entity filter contributes a soft RRF boost lane). Hard filters are AND-combined when multiple are supplied.

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
- **THEN** all records regardless of session or category are candidates

#### Scenario: entityName with high-relevance non-entity record still surfaces

- **WHEN** `ltm.query('typescript preferences', { entityName: 'typescript' })` is called and a record has high semantic similarity but no entity tag
- **THEN** that record still appears in results (entity filter does not exclude it)

### Requirement: Entity filter contributes a soft RRF boost lane

When `entityName` or `entityType` is present in `LtmQueryOptions`, the engine SHALL build an entity-ranked list: all candidate records matching the entity filter, ranked by their semantic score descending, each assigned a sequential rank starting at 1. This list SHALL be passed as a 4th lane to `rrfMerge` alongside the semantic, temporal, and associative lanes. Records not matching the entity filter receive no contribution from this lane but are not excluded.

#### Scenario: Entity-matching records score higher than non-matching

- **WHEN** `ltm.query('preferences', { entityName: 'alice' })` is called and two records are semantically similar but only one mentions 'alice' in its entities
- **THEN** the entity-tagged record has a higher `rrfScore` than the non-tagged record

#### Scenario: Non-entity records still appear in results

- **WHEN** `ltm.query('preferences', { entityName: 'alice' })` is called and a highly relevant record has no entity metadata
- **THEN** that record appears in results with a score derived from its semantic/temporal/associative lanes alone

#### Scenario: No entity filter leaves query behaviour unchanged

- **WHEN** `ltm.query('preferences')` is called with no `entityName` or `entityType`
- **THEN** query behaviour is identical to before this change (three RRF lanes only)
