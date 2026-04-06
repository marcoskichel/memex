## ADDED Requirements

### Requirement: Memory exposes recallFull

The `Memory` interface SHALL expose `recallFull(id: string): Promise<{ record: LtmRecord; episodeSummary: string | null }>`. It SHALL return the full `LtmRecord` plus `episodeSummary` as `null` when the record has none (semantic records or pre-migration episodics).

#### Scenario: recallFull returns episodeSummary for episodic records

- **WHEN** `memory.recallFull('record-id-with-summary')` is called
- **THEN** the result contains `record` and `episodeSummary` equal to the stored summary text

#### Scenario: recallFull returns null episodeSummary for semantic records

- **WHEN** `memory.recallFull('semantic-record-id')` is called
- **THEN** `episodeSummary` is `null`

#### Scenario: recallFull throws for unknown id

- **WHEN** `memory.recallFull('nonexistent-id')` is called
- **THEN** a `RecordNotFoundError` is thrown
