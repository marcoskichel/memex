## MODIFIED Requirements

### Requirement: Amygdala write path populates sessionId and episodeSummary

When amygdala inserts a record into LTM, it SHALL set `sessionId` from `AmygdalaConfig.sessionId` and `episodeSummary` from `InsightEntry.text`. Both fields are required on every insert; neither may be omitted.

#### Scenario: Record inserted with sessionId from config

- **WHEN** amygdala processes an insight entry with `AmygdalaConfig.sessionId = 'session-42'`
- **THEN** the resulting LTM record has `sessionId === 'session-42'`

#### Scenario: Record inserted with episodeSummary from entry text

- **WHEN** amygdala processes an insight with `InsightEntry.text = 'User prefers dark mode'`
- **THEN** the resulting LTM record has `episodeSummary === 'User prefers dark mode'`

### Requirement: Context file marked safeToDelete immediately after LTM write

After a successful LTM insert or relate call, amygdala SHALL immediately set `safeToDelete = true` on the associated context file record. It MUST NOT wait for hippocampus to process the record before marking it safe.

#### Scenario: Context file marked safe after successful insert

- **WHEN** amygdala successfully inserts a record with an associated context file
- **THEN** the context file record has `safeToDelete === true` before the amygdala cycle ends

#### Scenario: Context file not marked safe on LTM write failure

- **WHEN** the LTM insert fails (e.g. storage error)
- **THEN** `safeToDelete` remains `false` on the context file record

### Requirement: AmygdalaConfig requires sessionId

`AmygdalaConfig` SHALL include `sessionId: string` as a required field. The amygdala process MUST NOT start without a `sessionId` configured.

#### Scenario: AmygdalaConfig with sessionId

- **WHEN** amygdala is constructed with `{ sessionId: 'abc', ... }`
- **THEN** it starts without error and uses `'abc'` on all LTM writes
