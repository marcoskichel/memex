## ADDED Requirements

### Requirement: Phase as atomic compression unit

A phase SHALL be defined as exactly one tool call, its result, and the agent's reaction to it. `compress(phase)` SHALL accept this unit and return `{ compressed: string, insight: InsightEntry }`.

#### Scenario: compress returns both fields

- **WHEN** `compress(phase)` is called with a valid phase
- **THEN** the return value contains a non-empty `compressed` string and an `insight` conforming to the `InsightEntry` shape

#### Scenario: compress rejects incomplete phase

- **WHEN** `compress(phase)` is called with a phase missing `toolCall`, `result`, or `agentReaction`
- **THEN** an error is thrown and no insight is appended to the log

### Requirement: Compressed form replaces raw phase in context

The `compressed` string returned by `compress(phase)` SHALL be a compact representation suitable for the active context window. It SHALL replace the raw phase content in the context window, not append to it.

#### Scenario: Context window shrinks after compression

- **WHEN** `compress(phase)` is called and the compressed form is applied
- **THEN** the token count of the context window decreases relative to its pre-compression size

### Requirement: Raw phase content saved to context file before compression

Before generating the compressed form, the compressor SHALL write the full raw phase content to a file. The path to this file SHALL be included in the returned `insight.contextFile`.

#### Scenario: Context file written before compress returns

- **WHEN** `compress(phase)` returns
- **THEN** a file exists at `insight.contextFile` containing the full raw phase content

#### Scenario: Context file contains unaltered raw content

- **WHEN** the file at `insight.contextFile` is read
- **THEN** it contains the original tool call, result, and agent reaction without truncation

### Requirement: Compression is lossless for the context file

The compression operation SHALL never truncate, summarize, or alter the content written to the context file. Lossiness is permitted only in the `compressed` string, not in the file.

#### Scenario: Context file is byte-for-byte identical to raw input

- **WHEN** raw phase content of any length is compressed
- **THEN** the file at `insight.contextFile` contains exactly the same bytes as the original raw phase content

### Requirement: Insight written to STM log on compress

`compress(phase)` SHALL call `stm.append(insight)` before returning. Compression and STM entry creation are the same operation.

#### Scenario: Insight appears in STM log after compress

- **WHEN** `compress(phase)` is called
- **THEN** `stm.readUnprocessed()` includes the new insight entry

### Requirement: Threshold-based trigger

Context compression SHALL be triggered automatically when the context window token usage exceeds a configurable threshold. The default threshold SHALL be 70% of the configured `maxTokens`.

#### Scenario: Compression triggers at threshold

- **WHEN** context token usage reaches 70% of `maxTokens` and no custom threshold is set
- **THEN** `compress()` is invoked on the oldest uncompressed phase

#### Scenario: Custom threshold respected

- **WHEN** a threshold of 50% is configured at initialization
- **THEN** compression triggers when usage reaches 50% of `maxTokens`

### Requirement: Session-end flush

When the session ends, all remaining uncompressed phases SHALL be flushed by calling `compress()` on each of them in chronological order.

#### Scenario: Flush processes all remaining phases

- **WHEN** the session ends with three uncompressed phases
- **THEN** all three are compressed and their insights appear in the STM log before the flush completes

#### Scenario: Flush is synchronous

- **WHEN** the session-end flush is called
- **THEN** it completes before the process exits or any shutdown hook returns

### Requirement: Session-scoped context file path

Context files SHALL be stored at `<contextDir>/<sessionId>/<phaseId>.ctx`. `contextDir` SHALL default to `<db-dir>/context/`. The `sessionId` subdirectory isolates files across restarts, enabling orphan detection during startup.

#### Scenario: Context file path includes session subdirectory

- **WHEN** `compress(phase)` is called during session `sess-abc`
- **THEN** the context file is written to `<contextDir>/sess-abc/<phaseId>.ctx`

#### Scenario: contextDir defaults to db-dir/context

- **WHEN** no explicit `contextDir` is provided at initialization
- **THEN** context files are written under `<db-dir>/context/`

#### Scenario: Custom contextDir is respected

- **WHEN** `contextDir: '/tmp/ctx'` is configured at initialization
- **THEN** context files are written under `/tmp/ctx/<sessionId>/`

### Requirement: STM compressor does not delete context files

The STM compressor SHALL NOT delete context files. Context file deletion is owned by: the amygdala (marks `safeToDelete = true` on the context file record after processing), and the hippocampus (performs physical deletion in its pruning pass).

#### Scenario: Context file persists after compress returns

- **WHEN** `compress(phase)` returns successfully
- **THEN** the file at `insight.contextFile` still exists on disk

#### Scenario: compress does not call fs.unlink or equivalent

- **WHEN** the compress operation completes
- **THEN** no file deletion call was made for the context file
