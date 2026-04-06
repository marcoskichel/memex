## ADDED Requirements

### Requirement: LtmRecord carries optional category

`LtmRecord` SHALL have an optional `category?: string` field. Absence means uncategorised; the field MUST NOT be defaulted to any value by the library.

#### Scenario: Record inserted with category

- **WHEN** `ltm.insert({ ..., category: 'user_preference' })` is called
- **THEN** the stored record has `category === 'user_preference'` when retrieved

#### Scenario: Record inserted without category

- **WHEN** `ltm.insert({ ... })` is called without a `category`
- **THEN** the stored record has `category === undefined`

### Requirement: LtmCategory well-known constants exported

`@memex/ltm` SHALL export a `LtmCategory` object with at minimum the following keys: `USER_PREFERENCE`, `WORLD_FACT`, `TASK_CONTEXT`, `AGENT_BELIEF`. The type of `category` on `LtmRecord` SHALL remain `string`, not a closed union, allowing consumers to supply values outside `LtmCategory`.

#### Scenario: Consumer uses LtmCategory constant

- **WHEN** a caller writes `category: LtmCategory.USER_PREFERENCE`
- **THEN** the stored value is `'user_preference'`

#### Scenario: Consumer uses custom category string

- **WHEN** a caller writes `category: 'project_convention'`
- **THEN** the stored value is `'project_convention'` with no validation error

### Requirement: Category query filter

`LtmQueryOptions` SHALL accept an optional `category?: string`. When provided, only records with a matching `category` value are candidates for scoring. Records with `category === undefined` do not match any category filter.

#### Scenario: Query filtered by category

- **WHEN** `ltm.query('topic', { category: 'user_preference' })` is called
- **THEN** only records with `category === 'user_preference'` are returned

#### Scenario: Category filter excludes uncategorised records

- **WHEN** `ltm.query('topic', { category: 'world_fact' })` is called
- **THEN** records with no category are not returned
