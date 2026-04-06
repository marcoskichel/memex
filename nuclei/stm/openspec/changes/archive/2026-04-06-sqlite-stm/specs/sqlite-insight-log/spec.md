## ADDED Requirements

### Requirement: SqliteInsightLog persists insights to SQLite

`SqliteInsightLog` SHALL accept a `dbPath` string, open a `better-sqlite3` database at that path, and ensure the `insights` table exists before any operation is performed.

#### Scenario: Table created on first construction

- **WHEN** `new SqliteInsightLog(dbPath)` is called on a database with no `insights` table
- **THEN** the `insights` table is created with columns: `id TEXT PRIMARY KEY`, `summary TEXT NOT NULL`, `context_file TEXT NOT NULL`, `tags TEXT NOT NULL`, `timestamp INTEGER NOT NULL`, `processed INTEGER NOT NULL DEFAULT 0`, `safe_to_delete INTEGER`

#### Scenario: Construction is idempotent

- **WHEN** `new SqliteInsightLog(dbPath)` is called on a database that already has the `insights` table
- **THEN** no error is thrown and the existing rows are preserved

### Requirement: append writes a new insight row

`append` SHALL insert a new row into the `insights` table, assign a UUID `id`, record the current UTC timestamp, set `processed = 0`, and return the full `InsightEntry`.

#### Scenario: Appended entry is readable without a daemon

- **WHEN** a hook script constructs `new SqliteInsightLog(dbPath)`, calls `append(entry)`, and closes the process
- **THEN** a subsequent `new SqliteInsightLog(dbPath).readUnprocessed()` returns the appended entry with matching `id`, `summary`, `contextFile`, `tags`, `timestamp`, and `processed = false`

#### Scenario: Tags round-trip as an array

- **WHEN** `append` is called with `tags: ['foo', 'bar']`
- **THEN** `readUnprocessed()` returns an entry with `tags` equal to `['foo', 'bar']`

### Requirement: readUnprocessed returns only unprocessed entries in insertion order

`readUnprocessed` SHALL return all rows where `processed = 0`, ordered by `timestamp` ascending.

#### Scenario: Only unprocessed rows returned

- **WHEN** two entries are appended and one is marked processed
- **THEN** `readUnprocessed()` returns only the unprocessed entry

#### Scenario: Results ordered by timestamp ascending

- **WHEN** multiple unprocessed entries exist with different timestamps
- **THEN** `readUnprocessed()` returns them oldest-first

### Requirement: markProcessed sets processed flag on specified rows

`markProcessed` SHALL set `processed = 1` for every row whose `id` is in the provided array. Rows with IDs not in the array MUST NOT be modified.

#### Scenario: Targeted rows are marked

- **WHEN** `markProcessed(['id-1', 'id-2'])` is called
- **THEN** only rows with those ids have `processed = 1`; other rows remain `processed = 0`

#### Scenario: No-op for unknown IDs

- **WHEN** `markProcessed(['nonexistent-id'])` is called
- **THEN** no error is thrown and no rows are modified

### Requirement: clear removes only processed rows

`clear` SHALL delete all rows where `processed = 1`. Rows where `processed = 0` MUST NOT be deleted.

#### Scenario: Processed rows removed

- **WHEN** one processed and one unprocessed entry exist and `clear()` is called
- **THEN** `allEntries()` returns only the unprocessed entry

#### Scenario: Empty table after all processed

- **WHEN** all entries are marked processed and `clear()` is called
- **THEN** `allEntries()` returns an empty array

### Requirement: allEntries returns every row regardless of processed status

`allEntries` SHALL return all rows in the `insights` table with no filtering.

#### Scenario: Returns both processed and unprocessed

- **WHEN** two entries exist, one processed and one not
- **THEN** `allEntries()` returns both entries

### Requirement: safeToDelete field is persisted and restored correctly

`safeToDelete` is an optional boolean on `InsightEntry`. `SqliteInsightLog` SHALL store it as a nullable INTEGER (`1` / `0` / `NULL`) and deserialize it back to `true` / `false` / `undefined`.

#### Scenario: safeToDelete true round-trips

- **WHEN** `append` is called with `safeToDelete: true`
- **THEN** `allEntries()` returns the entry with `safeToDelete === true`

#### Scenario: safeToDelete undefined round-trips as undefined

- **WHEN** `append` is called without a `safeToDelete` field
- **THEN** `allEntries()` returns the entry with `safeToDelete === undefined`
