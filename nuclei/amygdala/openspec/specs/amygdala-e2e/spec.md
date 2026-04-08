## ADDED Requirements

### Requirement: E2E script inserts high-importance observations

The e2e script SHALL exercise `AmygdalaProcess.run()` with a clearly high-importance observation and assert that a record appears in `LtmEngine`.

#### Scenario: High-importance insert

- **WHEN** an `InsightEntry` with a clearly important summary is appended and `run()` is called
- **THEN** `LtmEngine` contains at least one record and the entry is marked processed

### Requirement: E2E script validates skip for trivial noise

The e2e script SHALL append an obviously trivial observation and assert that no LTM record is written.

#### Scenario: Noise skip

- **WHEN** an `InsightEntry` with a clearly trivial summary is appended and `run()` is called
- **THEN** `LtmEngine` contains no new records and the entry is marked processed

### Requirement: E2E script validates relate path

The e2e script SHALL set up an existing LTM memory, then append a clearly related follow-up observation and assert that a second LTM record is written.

#### Scenario: Follow-up relate

- **WHEN** a first observation is inserted, then a clearly related follow-up is appended and `run()` is called
- **THEN** a second LTM record exists (hard assert); the LLM edge type is logged (soft warn if unexpected)

### Requirement: E2E script validates low-cost mode

The e2e script SHALL run one scenario with `lowCostModeThreshold: 0`, forcing the low-cost prompt path (no context file read).

#### Scenario: Low-cost mode insert

- **WHEN** `lowCostModeThreshold` is set to 0 and an observation is appended and `run()` is called
- **THEN** a record is inserted into `LtmEngine` via the `buildPrompt` (no context) path

### Requirement: E2E script validates lock contention

The e2e script SHALL manually acquire the `amygdala` lock, then call `run()` and assert that no LLM calls are made.

#### Scenario: Lock contention defers cycle

- **WHEN** the `amygdala` lock is held externally and `run()` is called
- **THEN** the cycle is deferred and no LTM writes occur

### Requirement: E2E script exercises context file path

The e2e script SHALL write real temporary context files per scenario so that `buildPromptWithContext` is exercised on the default (non-low-cost) path.

#### Scenario: Context file content included in prompt

- **WHEN** an `InsightEntry` references a temp file with narrative content and `run()` is called in normal mode
- **THEN** the full processing completes without error (context excerpt was read and used)
