## ADDED Requirements

### Requirement: Background process cadence

The amygdala SHALL run as a background process on a configurable cadence. The default cadence SHALL be every 5 minutes OR when the STM log accumulates 10 or more unprocessed entries, whichever occurs first.

#### Scenario: Runs on time interval

- **WHEN** 5 minutes elapse since the last run and no threshold has been hit
- **THEN** the amygdala processing cycle executes

#### Scenario: Runs early when STM threshold is hit

- **WHEN** the STM log reaches 10 unprocessed entries before the 5-minute interval elapses
- **THEN** the amygdala processing cycle executes immediately

#### Scenario: Custom cadence respected

- **WHEN** cadence is configured to 2 minutes and entry threshold to 5
- **THEN** the process runs when either condition is met first

### Requirement: Per-entry processing pipeline

For each unprocessed STM entry, the amygdala SHALL execute the following steps in order: read summary and context file, query LTM for related memories, submit to LLM for scoring and action decision, execute the action, then mark the entry as processed.

#### Scenario: All pipeline steps complete before entry is marked processed

- **WHEN** an entry is being processed
- **THEN** the entry remains unprocessed in the STM log until the LTM action (insert, relate, or skip) has completed

#### Scenario: LTM query uses summary as input

- **WHEN** processing an STM entry
- **THEN** `ltm.query(summary, { limit: 3, strengthen: false })` is called with the entry's `summary`

### Requirement: LTM retrieval-encoding overlap check

Before scoring, the amygdala SHALL query LTM with the entry's summary to retrieve up to 3 related existing memories. The `strengthen` flag SHALL be `false` during this retrieval to avoid premature stability growth.

#### Scenario: Query does not strengthen related memories

- **WHEN** the amygdala queries LTM during processing
- **THEN** the `strengthen` option is `false` and no record stability values are modified

#### Scenario: Up to 3 related memories retrieved

- **WHEN** LTM contains 10 records all semantically related to the entry summary
- **THEN** only 3 are retrieved and passed to the LLM

### Requirement: LLM scoring produces importance and action

The amygdala SHALL submit the entry's summary, the contextFile excerpt, and the retrieved related LTM memories to an LLM. The LLM SHALL return an importance score 0–1 and an action of `insert`, `relate`, or `skip`.

#### Scenario: LLM receives all three inputs

- **WHEN** the LLM call is made for a given entry
- **THEN** the prompt includes the entry summary, a contextFile excerpt, and the serialized related LTM memories

#### Scenario: LLM response includes importance and action

- **WHEN** the LLM responds
- **THEN** the response contains a numeric importance in [0, 1] and one of `insert | relate | skip`

### Requirement: Insert action for novel memories

When the LLM returns action `insert`, the amygdala SHALL call `ltm.insert(summary, { importance })` and no relationship edge SHALL be created.

#### Scenario: Novel entry stored in LTM

- **WHEN** action is `insert` with `importance: 0.7`
- **THEN** `ltm.insert(summary, { importance: 0.7 })` is called and a new record exists in LTM

### Requirement: Relate action links to existing memory

When the LLM returns action `relate`, the amygdala SHALL call `ltm.insert(summary, { importance })` to create a new record, then call `ltm.relate(newId, relatedId, type)` where `type` is one of `'supersedes' | 'elaborates' | 'contradicts'` as inferred by the LLM.

#### Scenario: Related entry stored and linked

- **WHEN** action is `relate` and `relatedId` is the ID of the most relevant existing memory
- **THEN** `ltm.insert` is called first, then `ltm.relate(newId, relatedId, type)` is called with the LLM-inferred edge type

#### Scenario: Edge type is one of the allowed values

- **WHEN** the LLM infers the relationship type
- **THEN** it is exactly one of `supersedes`, `elaborates`, or `contradicts`

### Requirement: Skip action discards the entry

When the LLM returns action `skip`, the amygdala SHALL mark the STM entry as processed without writing anything to LTM.

#### Scenario: Skip leaves LTM unchanged

- **WHEN** action is `skip`
- **THEN** no `ltm.insert` or `ltm.relate` call is made and the entry is marked processed

### Requirement: Strictly asynchronous LTM writes

The amygdala SHALL never write to LTM synchronously during agent execution. All LTM writes SHALL occur exclusively within the background processing cycle.

#### Scenario: No LTM write occurs during agent's logInsight call

- **WHEN** `logInsight(...)` is called by agent code
- **THEN** no LTM insert or relate is triggered synchronously on the calling thread

### Requirement: Retry on LTM unavailability

If LTM is unavailable during a processing cycle, the amygdala SHALL leave all unprocessed entries in the STM log and retry them on the next cycle. No partial writes SHALL be committed for the failed cycle.

#### Scenario: Entries remain unprocessed on LTM failure

- **WHEN** LTM throws an error during `insert` for an entry
- **THEN** the entry remains unprocessed in the STM log and is included in the next cycle's batch

### Requirement: LLMAdapter injection

The amygdala SHALL accept an `LLMAdapter` instance at construction time. It SHALL NOT instantiate any specific LLM client internally. The adapter is injected by the caller (typically `createMemory()`).

#### Scenario: Amygdala accepts LLMAdapter at construction

- **WHEN** `new AmygdalaProcess({ llmAdapter, ... })` is called
- **THEN** the amygdala stores the adapter and uses it for all LLM calls

#### Scenario: Amygdala does not import Anthropic SDK directly

- **WHEN** the amygdala module is loaded
- **THEN** no direct import of `@anthropic-ai/sdk` or `openai` exists in amygdala source files

### Requirement: Structured LLM output with AmygdalaScoringResult schema

The amygdala SHALL use `llmAdapter.completeStructured()` with the `AmygdalaScoringResult` schema for each entry. The schema fields are: `action: 'insert' | 'relate' | 'skip'`, `targetId?: string`, `edgeType?: 'supersedes' | 'elaborates' | 'contradicts'`, `reasoning: string` (max 120 chars), `importanceScore: number` (0.0–1.0).

#### Scenario: completeStructured is called with AmygdalaScoringResult schema

- **WHEN** the amygdala processes an STM entry
- **THEN** `llmAdapter.completeStructured(prompt, amygdalaScoringSchema)` is called exactly once per entry

#### Scenario: relate without targetId is treated as insert

- **WHEN** the LLM returns `action: 'relate'` without a `targetId`
- **THEN** the entry is processed as `insert` with no edge created

### Requirement: Retry contract with failure escalation

On LLM failure, the amygdala SHALL retry at most 2 times with backoff of 500ms then 2000ms. On retry exhaustion, it SHALL mark the STM entry `importance_scoring_failed` and leave it unprocessed to rejoin the next cycle. After 3 consecutive cycles with `importance_scoring_failed` for the same entry, it SHALL mark the entry `permanently_skipped` and log a warning.

#### Scenario: First failure triggers retry at 500ms

- **WHEN** the LLM call fails on the first attempt
- **THEN** the amygdala waits 500ms and retries

#### Scenario: Second failure triggers retry at 2000ms

- **WHEN** the LLM call fails on the second attempt
- **THEN** the amygdala waits 2000ms and retries

#### Scenario: Third failure marks entry importance_scoring_failed

- **WHEN** all 3 attempts fail
- **THEN** the STM entry is marked `importance_scoring_failed` and the amygdala moves to the next entry

#### Scenario: Entry permanently skipped after 3 consecutive failed cycles

- **WHEN** the same entry has been marked `importance_scoring_failed` in 3 consecutive amygdala cycles
- **THEN** the entry is marked `permanently_skipped` and excluded from all future processing

### Requirement: Cost guard with degradation ladder

The amygdala SHALL track LLM calls per hour. When calls exceed 150 per hour (low-cost mode threshold), it SHALL activate a degradation ladder. When calls exceed 200 per hour (halt threshold), it SHALL halt all LLM calls for the remainder of the hour and mark affected entries `llm_rate_limited`.

#### Scenario: Low-cost mode activates at 150 calls/hour

- **WHEN** 150 LLM calls have been made in the current hour window
- **THEN** low-cost degradations are applied: context file excerpt omitted, related memories reduced to 1

#### Scenario: LLM calls halted at 200 calls/hour

- **WHEN** 200 LLM calls have been made in the current hour window
- **THEN** no further LLM calls are made; new entries are marked `llm_rate_limited`

#### Scenario: Rate-limited entries are retried in the next hour

- **WHEN** a new hour window begins
- **THEN** entries marked `llm_rate_limited` rejoin the processing queue

### Requirement: Context file safe-to-delete marking

After marking an STM entry `processed`, the amygdala SHALL set `safeToDelete = true` on the associated context file record regardless of the action taken (`insert`, `relate`, or `skip`). The amygdala SHALL NOT perform the physical file deletion.

#### Scenario: safeToDelete set after insert action

- **WHEN** the amygdala processes an entry and takes `insert` action
- **THEN** the entry's context file record has `safeToDelete = true`

#### Scenario: safeToDelete set after skip action

- **WHEN** the amygdala skips an entry
- **THEN** the entry's context file record has `safeToDelete = true`

#### Scenario: Amygdala does not delete the context file

- **WHEN** the amygdala marks `safeToDelete = true`
- **THEN** the context file still exists on disk

### Requirement: Typed event emission

The amygdala SHALL emit `amygdala:cycle:start` (with `cycleId`, `pendingCount`, `startedAt`) at the beginning of each processing cycle, `amygdala:cycle:end` (with `cycleId`, `durationMs`, `processed`, `failures`, `llmCalls`, `estimatedTokens`) at the end, and `amygdala:entry:scored` (with `insightId`, `action`, `importanceScore`, `relatedToId?`, `edgeType?`) for each processed entry.

#### Scenario: cycle:start emitted at cycle beginning

- **WHEN** a new amygdala processing cycle starts
- **THEN** `amygdala:cycle:start` is emitted before any entries are processed

#### Scenario: cycle:end emitted with duration and counts

- **WHEN** an amygdala cycle completes
- **THEN** `amygdala:cycle:end` is emitted with accurate `processed` and `failures` counts

#### Scenario: entry:scored emitted for each processed entry

- **WHEN** an entry is scored and action taken
- **THEN** `amygdala:entry:scored` is emitted with the entry's id and the LLM-determined action

### Requirement: process_locks acquisition before LTM writes

Before any LTM write batch, the amygdala SHALL acquire its `process_locks` entry via `storage.acquireLock('amygdala', cadenceMs * 2)`. If acquisition fails, the amygdala SHALL defer the current cycle. The lock SHALL always be released in a `finally` block.

#### Scenario: Cycle deferred when lock cannot be acquired

- **WHEN** the hippocampus holds the lock
- **THEN** the amygdala logs a warning and defers to the next scheduled cycle

#### Scenario: Lock always released after LTM write batch

- **WHEN** the amygdala's LTM write batch completes or throws
- **THEN** `storage.releaseLock('amygdala')` has been called

### Requirement: Default LLM model is claude-haiku-3-5

When no explicit model is configured, the amygdala's `AnthropicAdapter` SHALL default to `claude-haiku-3-5`. Reasoning-class models SHALL NOT be used — the amygdala is a classifier, not a reasoner.

#### Scenario: Default model is claude-haiku-3-5

- **WHEN** the amygdala is initialized without an explicit model override
- **THEN** LLM calls are made to `claude-haiku-3-5`
