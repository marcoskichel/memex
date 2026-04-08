## ADDED Requirements

### Requirement: startEngram boots cortex and returns an Engram

The e2e script SHALL call `startEngram()` with a real temp DB path and API keys and assert it returns a functioning `Engram` instance without throwing.

#### Scenario: startEngram resolves successfully

- **WHEN** `startEngram({ engramId, db, anthropicApiKey, openaiApiKey })` is called with valid credentials and a writable DB path
- **THEN** the returned `Engram` has a non-empty `engramId` matching the config
- **AND** no error is thrown during cortex startup or IPC connection

### Requirement: forkDatabase copies source DB before starting

The e2e script SHALL call `startEngram()` with a `source` DB path containing pre-seeded data and assert the fork path succeeds.

#### Scenario: startEngram with source forks the database

- **WHEN** `startEngram({ source, db, ... })` is called with a source DB that has at least one record
- **THEN** the destination DB file exists after startup
- **AND** `getStats()` returns `ltm.totalRecords >= 1` reflecting the forked data

### Requirement: insertMemory and recall round-trip through IPC

The e2e script SHALL call `Engram.insertMemory()` and assert the record is retrievable via `Engram.recall()`.

#### Scenario: Inserted memory is retrievable via IPC

- **WHEN** a fact is inserted via `insertMemory()`
- **THEN** `recall()` with a semantically related query returns at least one result
- **AND** no IPC error is thrown

### Requirement: getStats returns a parseable stats object

The e2e script SHALL call `Engram.getStats()` and assert the result contains expected fields.

#### Scenario: getStats returns stats with ltm record count

- **WHEN** `getStats()` is called after insertions
- **THEN** the result is a non-null object
- **AND** it contains a numeric record count greater than zero

### Requirement: Engram.close() terminates the cortex process cleanly

The e2e script SHALL call `Engram.close()` and assert the cortex child process exits within the force-kill timeout.

#### Scenario: close resolves without hanging

- **WHEN** `close()` is called on a running Engram
- **THEN** the method resolves within 15 seconds
- **AND** subsequent IPC calls throw or reject (cortex is no longer running)
