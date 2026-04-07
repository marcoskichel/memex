## ADDED Requirements

### Requirement: Consolidated semantic records inherit entity mentions from sources

When `consolidate(sourceIds, data, options)` creates a semantic record, it SHALL collect `metadata.entities` from all source records, union them, deduplicate by `name+type` pair, and include the result as `entities` in the new record's metadata. If no source record has `metadata.entities`, the field is omitted.

#### Scenario: Entity union from two sources

- **WHEN** source record A has `metadata.entities = [{ name: 'alice', type: 'person' }]` and source record B has `metadata.entities = [{ name: 'sqlite', type: 'tool' }]`
- **THEN** the consolidated semantic record has `metadata.entities = [{ name: 'alice', type: 'person' }, { name: 'sqlite', type: 'tool' }]`

#### Scenario: Duplicate entities are deduplicated

- **WHEN** two source records both have `{ name: 'alice', type: 'person' }` in their entities
- **THEN** the consolidated record contains that entity exactly once

#### Scenario: Sources with no entities produce no entities field

- **WHEN** no source record has `metadata.entities`
- **THEN** the consolidated record's metadata does not include an `entities` key

#### Scenario: Entity-filtered query finds consolidated semantic record

- **WHEN** episodic records mentioning 'alice' are consolidated into a semantic record
- **THEN** `ltm.query('alice', { entityName: 'alice' })` returns the semantic record
