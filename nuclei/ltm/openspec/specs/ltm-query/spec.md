## MODIFIED Requirements

### Requirement: LtmQueryOptions supports sessionId and category filters

`LtmQueryOptions` SHALL accept `sessionId?: string` and `category?: string`. Both filters, when present, SHALL be applied as SQL WHERE clauses before records are loaded into memory for embedding scoring. Filters are AND-combined when both are supplied.

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
