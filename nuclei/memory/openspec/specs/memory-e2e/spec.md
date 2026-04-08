## ADDED Requirements

### Requirement: createMemory wiring validation

The e2e script SHALL call `createMemory()` with real adapters and assert the returned `Memory` instance is operational.

#### Scenario: createMemory returns a functional Memory instance

- **WHEN** `createMemory()` is called with a real `AnthropicAdapter`, `OpenAIEmbeddingAdapter`, and `SqliteAdapter` path
- **THEN** the returned object exposes `engramId`, `recall`, `insertMemory`, `logInsight`, `stats`, and `shutdown`
- **AND** `stats()` returns an object with numeric LTM and STM counts

### Requirement: importText extracts and stores facts via LLM

The e2e script SHALL call `Memory.importText()` with a multi-sentence paragraph and assert that at least one record is inserted into LTM and is retrievable via `recall()`.

#### Scenario: importText inserts retrievable records

- **WHEN** `importText()` is called with a paragraph containing multiple discrete facts
- **THEN** the result is `ok` with `inserted >= 1`
- **AND** calling `recall()` with a semantically related query returns at least one result

#### Scenario: importText with empty string returns zero insertions

- **WHEN** `importText()` is called with an empty string or whitespace-only input
- **THEN** the result is `ok` with `inserted === 0`

### Requirement: insertMemory and recall round-trip

The e2e script SHALL call `Memory.insertMemory()` directly and assert the record is immediately retrievable via `recall()`.

#### Scenario: Inserted memory is retrievable by semantic query

- **WHEN** a specific factual string is inserted via `insertMemory()`
- **THEN** `recall()` with a semantically related query returns that record in results
- **AND** the result's `record.data` matches or is semantically close to the inserted string

### Requirement: logInsight populates STM context

The e2e script SHALL call `Memory.logInsight()` and assert the context file is written to disk.

#### Scenario: logInsight writes context file

- **WHEN** `logInsight()` is called with a summary and context file path
- **THEN** the context file exists on disk and is non-empty

### Requirement: stats reflect memory state

The e2e script SHALL assert that `Memory.stats()` returns counts consistent with the operations performed.

#### Scenario: Stats increase after insertions

- **WHEN** records have been inserted via `insertMemory()` or `importText()`
- **THEN** `stats().ltm.totalRecords` is greater than zero

### Requirement: shutdown completes cleanly

The e2e script SHALL call `Memory.shutdown()` and assert it resolves without error.

#### Scenario: shutdown resolves successfully

- **WHEN** `shutdown()` is called after memory operations
- **THEN** the returned `ShutdownReport` has `engramId` matching the memory instance
- **AND** no error is thrown
