## MODIFIED Requirements

### Requirement: LtmRecord shape

`LtmRecord` SHALL include `sessionId: string`, `category?: string`, `episodeSummary?: string`, and `metadata: Record<string, unknown>` in addition to all existing fields. The `metadata` field SHALL support an optional `entities: EntityMention[]` sub-field. The `StorageAdapter` interface SHALL persist and return all fields on all read and write paths.

#### Scenario: All new fields persisted on insert

- **WHEN** `ltm.insert({ sessionId: 's1', category: 'world_fact', episodeSummary: 'summary text', data: '...' })` is called
- **THEN** retrieving the record by ID returns all three new fields with their supplied values

#### Scenario: Null/undefined new fields handled on read

- **WHEN** a record stored before the migration is retrieved
- **THEN** `sessionId === 'legacy'`, `category === undefined`, `episodeSummary === undefined`

#### Scenario: Entity mentions persisted in metadata

- **WHEN** `ltm.insert({ ..., metadata: { entities: [{ name: 'Marcos', type: 'person' }] } })` is called
- **THEN** retrieving the record returns `metadata.entities` containing the inserted entity mention

#### Scenario: Records without entities have no metadata.entities

- **WHEN** a record is inserted without a `metadata.entities` field
- **THEN** `record.metadata.entities` is `undefined` on retrieval
