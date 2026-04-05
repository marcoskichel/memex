## ADDED Requirements

### Requirement: LtmRecord carries sessionId

Every `LtmRecord` SHALL have a `sessionId: string` field populated at insert time. Records inserted before this migration SHALL have `sessionId === 'legacy'`.

#### Scenario: Record inserted with sessionId

- **WHEN** `ltm.insert({ ..., sessionId: 'abc-123' })` is called
- **THEN** the stored record has `sessionId === 'abc-123'` when retrieved

#### Scenario: Pre-migration records have legacy sessionId

- **WHEN** a record inserted before the migration is retrieved
- **THEN** `record.sessionId === 'legacy'`

### Requirement: Session-scoped query filter

`LtmQueryOptions` SHALL accept an optional `sessionId?: string`. When provided, only records with a matching `session_id` column value are candidates for scoring.

#### Scenario: Query filtered by sessionId

- **WHEN** `ltm.query('topic', { sessionId: 'abc-123' })` is called
- **THEN** only records with `sessionId === 'abc-123'` are returned

#### Scenario: Query without sessionId filter returns all sessions

- **WHEN** `ltm.query('topic')` is called without `sessionId`
- **THEN** records from all sessions are candidates

### Requirement: sessionId filter is applied before embedding scoring

The `sessionId` filter SHALL be applied as a SQL WHERE clause before cosine similarity is computed, not as post-retrieval filtering.

#### Scenario: Performance — only matching session rows scored

- **WHEN** the database contains 10,000 records across 100 sessions and `sessionId` is specified
- **THEN** only the records for that session are loaded into memory for scoring
