## ADDED Requirements

### Requirement: LtmRecord carries optional episodeSummary

`LtmRecord` SHALL have an optional `episodeSummary?: string` field. It is populated only for episodic-tier records; semantic records SHALL have `episodeSummary === undefined`. The library MUST NOT compute or derive this value — it is always caller-supplied at insert time.

#### Scenario: Episodic record inserted with episodeSummary

- **WHEN** `ltm.insert({ tier: 'episodic', episodeSummary: '<compressed text>', ... })` is called
- **THEN** the stored record has `episodeSummary` equal to the supplied string when retrieved

#### Scenario: Semantic record has no episodeSummary

- **WHEN** a semantic record is created via `ltm.consolidate()`
- **THEN** `record.episodeSummary === undefined`

#### Scenario: Episodic record inserted without episodeSummary

- **WHEN** `ltm.insert({ tier: 'episodic', ... })` is called without `episodeSummary`
- **THEN** `record.episodeSummary === undefined` — absence is valid, no error

### Requirement: episodeSummary is persisted and returned on retrieval

The `episode_summary` column SHALL be persisted in SQLite and returned as part of `LtmRecord` on all read paths (query, getById, bulkGet).

#### Scenario: episodeSummary survives round-trip

- **WHEN** a record is inserted with `episodeSummary` and then retrieved by ID
- **THEN** `retrieved.episodeSummary` equals the originally inserted value exactly
