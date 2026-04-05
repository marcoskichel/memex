## MODIFIED Requirements

### Requirement: LtmRecord shape

`LtmRecord` SHALL include `sessionId: string`, `category?: string`, and `episodeSummary?: string` in addition to all existing fields. The `StorageAdapter` interface SHALL persist and return these fields on all read and write paths.

#### Scenario: All new fields persisted on insert

- **WHEN** `ltm.insert({ sessionId: 's1', category: 'world_fact', episodeSummary: 'summary text', data: '...' })` is called
- **THEN** retrieving the record by ID returns all three new fields with their supplied values

#### Scenario: Null/undefined new fields handled on read

- **WHEN** a record stored before the migration is retrieved
- **THEN** `sessionId === 'legacy'`, `category === undefined`, `episodeSummary === undefined`
