## NEW Requirements

### Requirement: LtmQueryOptions accepts tags filter

`LtmQueryOptions` SHALL accept `tags?: string[]`. When present and non-empty, only records whose `metadata.tags` contains ALL specified tags SHALL be returned. When absent or empty, the filter is not applied (existing behaviour unchanged).

#### Scenario: Single tag filter matches records containing the tag

- **WHEN** `ltm.query('topic', { tags: ['behavioral'] })` is called
- **THEN** only records with `metadata.tags` containing `'behavioral'` are candidates for scoring

#### Scenario: Multi-tag filter uses AND-semantics

- **WHEN** `ltm.query('topic', { tags: ['behavioral', 'preference'] })` is called
- **THEN** only records with `metadata.tags` containing BOTH `'behavioral'` AND `'preference'` are candidates

#### Scenario: Tag filter excludes records missing any specified tag

- **WHEN** a record has `metadata.tags = ['behavioral']` and filter is `{ tags: ['behavioral', 'preference'] }`
- **THEN** that record is excluded from results

#### Scenario: Empty tags filter applies no restriction

- **WHEN** `ltm.query('topic', { tags: [] })` is called
- **THEN** all records are candidates regardless of their tags (same as omitting the filter)

#### Scenario: Absent tags filter applies no restriction

- **WHEN** `ltm.query('topic')` is called without `tags`
- **THEN** all records are candidates regardless of their tags

#### Scenario: Records with missing metadata.tags are excluded

- **WHEN** a record has no `metadata.tags` field and filter is `{ tags: ['behavioral'] }`
- **THEN** that record is excluded from results

#### Scenario: Records with non-array metadata.tags are excluded

- **WHEN** a record has `metadata.tags = 'behavioral'` (string, not array) and filter is `{ tags: ['behavioral'] }`
- **THEN** that record is excluded from results

### Requirement: Tags filter combines with other LtmQueryOptions filters

When `tags` is specified alongside other filters (e.g. `tier`, `minImportance`), all filters SHALL be AND-combined. A record must satisfy every specified filter to be a candidate.

#### Scenario: Tags and tier filters combined

- **WHEN** `ltm.query('topic', { tags: ['behavioral'], tier: 'semantic' })` is called
- **THEN** only records that are both `tier === 'semantic'` AND have `metadata.tags` containing `'behavioral'` are candidates
