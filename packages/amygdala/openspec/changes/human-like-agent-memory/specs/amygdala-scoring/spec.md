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
