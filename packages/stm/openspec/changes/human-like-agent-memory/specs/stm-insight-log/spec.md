## ADDED Requirements

### Requirement: Insight entry shape

The log SHALL accept entries of shape `{ summary: string, contextFile: string, tags: string[], timestamp: Date }` and reject entries missing any required field.

#### Scenario: Valid entry accepted

- **WHEN** `append({ summary, contextFile, tags, timestamp })` is called with all fields present
- **THEN** the entry is stored and a unique entry ID is returned

#### Scenario: Entry missing required field rejected

- **WHEN** `append(entry)` is called with `summary` absent
- **THEN** an error is thrown and no entry is stored

### Requirement: Append-only semantics

The log SHALL only allow adding new entries. Existing entries SHALL never be mutated through any public API.

#### Scenario: No update API exists

- **WHEN** the public API surface of the log is inspected
- **THEN** no method for modifying an existing entry's `summary`, `contextFile`, or `tags` is present

### Requirement: Read unprocessed entries

`readUnprocessed()` SHALL return all entries where `processed` is `false`, ordered by `timestamp` ascending.

#### Scenario: Returns only unprocessed entries

- **WHEN** three entries exist and two are marked processed
- **THEN** `readUnprocessed()` returns exactly the one unprocessed entry

#### Scenario: Results ordered by timestamp ascending

- **WHEN** multiple unprocessed entries exist with different timestamps
- **THEN** they are returned oldest-first

#### Scenario: Returns empty array when all processed

- **WHEN** all entries have been marked processed
- **THEN** `readUnprocessed()` returns an empty array

### Requirement: Mark entries as processed

`markProcessed(ids[])` SHALL set `processed = true` for each given ID. Marked entries SHALL no longer appear in `readUnprocessed()`.

#### Scenario: Marked entries excluded from future reads

- **WHEN** `markProcessed([id1, id2])` is called
- **THEN** `readUnprocessed()` no longer returns entries with those IDs

#### Scenario: Unknown IDs are ignored

- **WHEN** `markProcessed([unknownId])` is called
- **THEN** no error is thrown and no state changes occur for other entries

### Requirement: Clear removes only processed entries

`clear()` SHALL remove all entries where `processed = true`. Unprocessed entries SHALL be retained.

#### Scenario: Processed entries removed

- **WHEN** `clear()` is called with a mix of processed and unprocessed entries
- **THEN** only the processed entries are removed

#### Scenario: Unprocessed entries survive clear

- **WHEN** `clear()` is called
- **THEN** all entries where `processed = false` remain retrievable via `readUnprocessed()`

### Requirement: Session-scoped in-memory storage

The log SHALL store all entries in process memory only. It SHALL NOT persist entries to disk, network, or any external store. All entries SHALL be lost on process restart.

#### Scenario: Entries do not survive restart

- **WHEN** the process is restarted and the log is re-instantiated
- **THEN** `readUnprocessed()` returns an empty array

### Requirement: Context file is a pointer, not content

The `contextFile` field in each entry SHALL be a filesystem path to a file containing the raw phase content. The log itself SHALL NOT store or validate the raw content — it only stores the path.

#### Scenario: Log stores path, not raw content

- **WHEN** an entry is appended with `contextFile: '/tmp/session/phase-42.txt'`
- **THEN** the stored entry's `contextFile` value is exactly `'/tmp/session/phase-42.txt'` with no content inlined

### Requirement: No vector search or relationship graph

The log SHALL expose no similarity search, embedding, decay, or relationship APIs. It SHALL operate as a pure FIFO queue.

#### Scenario: No query-by-similarity method exists

- **WHEN** the public API surface of the log is inspected
- **THEN** no method accepting a natural language query or returning similarity scores is present
