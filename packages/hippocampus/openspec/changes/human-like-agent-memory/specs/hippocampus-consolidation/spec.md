## ADDED Requirements

### Requirement: Configurable schedule

The hippocampus SHALL run on a configurable schedule. The default SHALL be once per hour. It SHALL also support being triggered explicitly via a public `run()` method.

#### Scenario: Runs on hourly default

- **WHEN** no custom schedule is provided at initialization
- **THEN** the consolidation and pruning passes execute once per hour

#### Scenario: Custom schedule respected

- **WHEN** a schedule of 30 minutes is configured
- **THEN** the passes execute every 30 minutes

#### Scenario: Explicit trigger executes immediately

- **WHEN** `hippocampus.run()` is called
- **THEN** the full consolidation and pruning cycle executes synchronously and completes before returning

### Requirement: Consolidation candidate discovery

The hippocampus SHALL call `ltm.findConsolidationCandidates({ similarityThreshold: 0.85, minAccessCount: 2 })` to retrieve clusters of episodic records eligible for consolidation.

#### Scenario: Candidates retrieved with correct parameters

- **WHEN** the consolidation pass begins
- **THEN** `ltm.findConsolidationCandidates` is called with `similarityThreshold: 0.85` and `minAccessCount: 2`

#### Scenario: Clusters with fewer than 3 members are skipped

- **WHEN** a returned cluster contains only 2 records
- **THEN** no LLM call is made for that cluster and no consolidation occurs

### Requirement: LLM summarization of qualifying clusters

For each cluster with 3 or more members, the hippocampus SHALL submit the cluster's records to an LLM and obtain a single semantic summary.

#### Scenario: LLM receives full cluster content

- **WHEN** a cluster of 4 records is submitted for summarization
- **THEN** the LLM prompt includes all 4 records' summaries

#### Scenario: LLM returns a single semantic summary

- **WHEN** the LLM responds
- **THEN** a single non-empty string summary is extracted and used as the consolidation target

### Requirement: Consolidation via LTM API

After obtaining the LLM summary, the hippocampus SHALL call `ltm.consolidate(sourceIds, summary, { deflateSourceStability: true })`.

#### Scenario: Consolidate called with all source IDs and summary

- **WHEN** a cluster of IDs `[1, 2, 3]` is consolidated with summary `"S"`
- **THEN** `ltm.consolidate([1, 2, 3], 'S', { deflateSourceStability: true })` is called exactly once

#### Scenario: deflateSourceStability is always true

- **WHEN** `ltm.consolidate` is called by the hippocampus
- **THEN** the `deflateSourceStability` option is always `true`

### Requirement: Pruning pass after consolidation

After the consolidation pass completes, the hippocampus SHALL call `ltm.prune({ minRetention: 0.1 })` to remove fully-faded records.

#### Scenario: Prune runs after every consolidation pass

- **WHEN** the hippocampus cycle completes
- **THEN** `ltm.prune({ minRetention: 0.1 })` has been called exactly once in that cycle

#### Scenario: Prune does not run if consolidation errors

- **WHEN** the consolidation pass throws an unrecovered error
- **THEN** `ltm.prune` is not called in that cycle

### Requirement: Advisory lock to prevent amygdala race conditions

The hippocampus SHALL NOT run its consolidation or pruning pass while the amygdala is mid-write. It SHALL check a shared advisory flag before starting and skip the cycle if the flag indicates the amygdala is active.

#### Scenario: Hippocampus skips cycle when amygdala flag is set

- **WHEN** the amygdala sets the shared flag to indicate it is writing
- **THEN** the hippocampus defers its cycle until the flag is cleared

#### Scenario: Hippocampus proceeds when flag is clear

- **WHEN** the shared flag is not set
- **THEN** the hippocampus begins its cycle without delay

### Requirement: Consolidation idempotency

Running the hippocampus twice on identical LTM state SHALL produce the same LTM state as running it once.

#### Scenario: Second run produces no additional consolidations

- **WHEN** the hippocampus runs, then runs again without any new amygdala writes in between
- **THEN** no additional `ltm.consolidate` calls are made on the second run

### Requirement: Consolidated record stability is enforced by LTM

The hippocampus SHALL NOT compute or set the stability of the consolidated semantic record. Stability inheritance from source records SHALL be enforced entirely by the LTM `consolidate()` implementation.

#### Scenario: Hippocampus does not pass a stability value to consolidate

- **WHEN** `ltm.consolidate(sourceIds, summary, options)` is called
- **THEN** no `stability` field is present in the `options` argument
