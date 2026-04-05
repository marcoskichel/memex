## ADDED Requirements

### Requirement: LtmInsertOptions accepts tier override

`LtmInsertOptions` SHALL accept an optional `tier?: 'episodic' | 'semantic'`. When omitted, the default is `'episodic'` (existing behaviour unchanged).

#### Scenario: Default tier is episodic

- **WHEN** `ltm.insert({ data: '...' })` is called without `tier`
- **THEN** the stored record has `tier === 'episodic'`

### Requirement: Semantic tier insertion requires confidence

When `tier: 'semantic'` is supplied, the `confidence` value SHALL be set. If the caller omits it, the library SHALL default `confidence` to `1.0` in the record's metadata. The library MUST NOT throw when `confidence` is absent — it defaults silently.

#### Scenario: Semantic record inserted with confidence

- **WHEN** `ltm.insert({ tier: 'semantic', metadata: { confidence: 0.9 }, data: '...' })` is called
- **THEN** the stored record has `tier === 'semantic'` and `metadata.confidence === 0.9`

#### Scenario: Semantic record inserted without confidence defaults to 1.0

- **WHEN** `ltm.insert({ tier: 'semantic', data: '...' })` is called without `confidence` in metadata
- **THEN** the stored record has `tier === 'semantic'` and `metadata.confidence === 1.0`

### Requirement: bulkInsert supports tier override per record

`LtmBulkInsertOptions` SHALL allow each entry to carry its own `tier?`. Mixed-tier bulk inserts (some episodic, some semantic) SHALL be supported in a single call.

#### Scenario: Mixed-tier bulk insert

- **WHEN** `ltm.bulkInsert([{ data: 'a', tier: 'episodic' }, { data: 'b', tier: 'semantic' }])` is called
- **THEN** two records are stored with their respective tiers
