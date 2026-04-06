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

### Requirement: LLMAdapter injection

The hippocampus SHALL accept an `LLMAdapter` instance at construction time. It SHALL NOT instantiate any specific LLM client internally.

#### Scenario: Hippocampus accepts LLMAdapter at construction

- **WHEN** `new HippocampusProcess({ llmAdapter, ... })` is called
- **THEN** the hippocampus stores the adapter and uses it for all consolidation LLM calls

### Requirement: Structured LLM output with ConsolidationResult schema

The hippocampus SHALL use `llmAdapter.completeStructured()` with the `ConsolidationResult` schema: `summary: string` (max 3 sentences), `confidence: number` (0.0–1.0), `preservedFacts: string[]` (atomic claims), `uncertainties: string[]` (conflicting or inferred claims).

#### Scenario: completeStructured called with ConsolidationResult schema

- **WHEN** a cluster is submitted for consolidation
- **THEN** `llmAdapter.completeStructured(prompt, consolidationSchema)` is called once

#### Scenario: Minimum cluster size of 3 is enforced

- **WHEN** `findConsolidationCandidates` returns a cluster of 2 records
- **THEN** no LLM call is made for that cluster

### Requirement: Confidence forwarded to ltm.consolidate

The hippocampus SHALL pass the `confidence` value from the LLM response directly to `ltm.consolidate()` as `options.confidence`. The hippocampus SHALL NOT interpret, adjust, or act on the confidence value beyond forwarding it.

#### Scenario: confidence from LLM is forwarded unchanged

- **WHEN** the LLM returns `confidence: 0.6`
- **THEN** `ltm.consolidate(sourceIds, summary, { ..., confidence: 0.6 })` is called with exactly `0.6`

#### Scenario: Low confidence does not cause the cluster to be skipped

- **WHEN** the LLM returns `confidence: 0.2`
- **THEN** `ltm.consolidate` is still called; the low confidence is handled by the LTM stability formula

### Requirement: Retry contract

On LLM failure, the hippocampus SHALL retry at most 1 time with backoff of 1000ms. On retry exhaustion, it SHALL skip the cluster for this cycle; source records SHALL remain untouched.

#### Scenario: Single retry at 1000ms

- **WHEN** the LLM call fails on first attempt
- **THEN** the hippocampus waits 1000ms and retries once

#### Scenario: Cluster skipped on second failure

- **WHEN** both the initial call and retry fail
- **THEN** the cluster is skipped; source episodic records are not modified

### Requirement: process_locks acquisition before consolidation pass

Before beginning the consolidation pass, the hippocampus SHALL acquire its `process_locks` entry via `storage.acquireLock('hippocampus', scheduleMs * 2)`. If acquisition fails, the hippocampus SHALL skip the entire cycle. The lock SHALL always be released in a `finally` block.

#### Scenario: Cycle skipped when lock cannot be acquired

- **WHEN** the amygdala holds the lock
- **THEN** the hippocampus skips the full consolidation and pruning pass for this cycle

#### Scenario: Lock released after consolidation pass

- **WHEN** the hippocampus consolidation pass completes or throws
- **THEN** `storage.releaseLock('hippocampus')` has been called

### Requirement: Context file deletion after pruning

After `ltm.prune()` completes, the hippocampus SHALL delete all context files marked `safeToDelete = true`. Deletion errors SHALL be non-fatal and SHALL be counted in the `HippocampusConsolidationEndPayload.contextFilesDeleted` field.

#### Scenario: Context files deleted after prune

- **WHEN** the hippocampus pruning pass completes
- **THEN** all context files with `safeToDelete = true` are deleted from disk

#### Scenario: Deletion error does not abort the cycle

- **WHEN** a context file cannot be deleted (e.g., permissions error)
- **THEN** the error is logged, counted in `contextFilesDeleted` failures, and the cycle completes normally

### Requirement: Typed event emission including false memory risk

The hippocampus SHALL emit `hippocampus:consolidation:start` at the start of each cycle and `hippocampus:consolidation:end` (with `runId`, `durationMs`, `clustersConsolidated`, `recordsPruned`, `contextFilesDeleted`) at the end. For each consolidated record with `confidence < 0.5`, it SHALL emit `hippocampus:false-memory-risk` (with `recordId`, `confidence`, `sourceIds`).

#### Scenario: consolidation:start emitted before any LTM writes

- **WHEN** a hippocampus consolidation cycle begins
- **THEN** `hippocampus:consolidation:start` is emitted before any `ltm.consolidate` call

#### Scenario: consolidation:end emitted with accurate counts

- **WHEN** the hippocampus cycle completes
- **THEN** `hippocampus:consolidation:end` is emitted with accurate `clustersConsolidated` and `recordsPruned` counts

#### Scenario: false-memory-risk emitted for low-confidence records

- **WHEN** a semantic record is created with `confidence: 0.4`
- **THEN** `hippocampus:false-memory-risk` is emitted with the new record's id and source ids

### Requirement: Cost guard via maxLLMCallsPerHour

The hippocampus SHALL respect `maxLLMCallsPerHour`. When the budget is exhausted, the hippocampus SHALL defer the entire consolidation cycle to the next scheduled run.

#### Scenario: Entire cycle deferred when budget exhausted

- **WHEN** LLM calls for this hour have reached `maxLLMCallsPerHour`
- **THEN** the hippocampus defers consolidation; no `ltm.consolidate` or `ltm.prune` calls are made
