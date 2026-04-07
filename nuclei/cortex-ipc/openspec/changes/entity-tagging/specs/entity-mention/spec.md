## ADDED Requirements

### Requirement: EntityType union type

The package SHALL export an `EntityType` string union covering the supported entity categories: `'person' | 'project' | 'concept' | 'preference' | 'decision' | 'tool'`.

#### Scenario: EntityType is exported from package root

- **WHEN** a consumer imports `EntityType` from `@neurome/cortex-ipc`
- **THEN** the import resolves without error and the type accepts only the defined string literals

### Requirement: EntityMention interface

The package SHALL export an `EntityMention` interface with `name: string` and `type: EntityType` fields.

#### Scenario: EntityMention is exported from package root

- **WHEN** a consumer imports `EntityMention` from `@neurome/cortex-ipc`
- **THEN** the import resolves without error and the interface enforces both required fields

#### Scenario: EntityMention rejects unknown entity types

- **WHEN** a value is typed as `EntityMention` with a `type` field not in `EntityType`
- **THEN** TypeScript reports a compile-time type error
