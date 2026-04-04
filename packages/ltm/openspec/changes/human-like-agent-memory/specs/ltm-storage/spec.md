## ADDED Requirements

### Requirement: Record insertion

The engine SHALL accept a string and optional metadata, assign a monotonically increasing integer ID, and persist the record via the storage adapter.

#### Scenario: Insert returns a new ID

- **WHEN** `insert(data, { importance, metadata })` is called
- **THEN** a unique positive integer ID is returned and the record is retrievable

#### Scenario: Insert with defaults

- **WHEN** `insert(data)` is called with no options
- **THEN** importance defaults to 0 and metadata defaults to an empty object

### Requirement: Record immutability

The engine SHALL treat record data as immutable after creation. The `update()` method SHALL only patch `metadata`; it SHALL never modify `data` or recompute the embedding.

#### Scenario: Update patches metadata only

- **WHEN** `update(id, { metadata: { tag: 'x' } })` is called on an existing record
- **THEN** the stored metadata is merged with the patch and the record's data and embedding remain unchanged

#### Scenario: Update returns false for unknown ID

- **WHEN** `update(id, ...)` is called with an ID that does not exist
- **THEN** it returns `false` and no state changes occur

### Requirement: Data mutation via supersedes chain

The engine SHALL require that data changes be expressed as a new `insert()` followed by `relate(newId, oldId, 'supersedes')`. Direct mutation of existing record data SHALL never be possible through any public API.

#### Scenario: New version linked to old

- **WHEN** a consumer inserts a corrected version and calls `relate(newId, oldId, 'supersedes')`
- **THEN** a `supersedes` edge exists from `newId` to `oldId`

### Requirement: Bulk insert atomicity

The engine SHALL provide `bulkInsert(entries[])` that succeeds entirely or fails entirely. No partial writes SHALL be committed.

#### Scenario: All records inserted or none

- **WHEN** `bulkInsert([...])` is called with N entries
- **THEN** either N IDs are returned and all records are stored, or an error is thrown and no records are stored

#### Scenario: Returns IDs in input order

- **WHEN** `bulkInsert([...])` succeeds
- **THEN** the returned array has the same length as input and IDs correspond positionally to entries

### Requirement: Record deletion with edge cleanup

The engine SHALL remove the record and all edges where it is the `fromId` or `toId` when `delete(id)` is called.

#### Scenario: Delete existing record

- **WHEN** `delete(id)` is called for an existing record
- **THEN** it returns `true`, the record is no longer retrievable, and all edges involving that ID are removed

#### Scenario: Delete non-existent record

- **WHEN** `delete(id)` is called for an unknown ID
- **THEN** it returns `false` and no state changes occur

### Requirement: Typed relationship edges

The engine SHALL allow `relate(fromId, toId, type)` to create a directed edge of type `'supersedes' | 'consolidates' | 'contradicts' | 'elaborates'` between two existing records.

#### Scenario: Edge created between existing records

- **WHEN** `relate(fromId, toId, 'supersedes')` is called and both records exist
- **THEN** a new edge ID is returned and the edge is retrievable via `edgesFrom(fromId)`

#### Scenario: Relate fails for unknown node

- **WHEN** `relate(fromId, toId, type)` is called and either ID does not exist
- **THEN** an error is thrown and no edge is created

### Requirement: Edge independence

Edges SHALL be first-class entities with their own lifecycle: their own `id`, `stability`, `createdAt`, `lastAccessedAt`, and `accessCount`. Deleting a record SHALL delete its edges, but edges SHALL otherwise exist independently.

#### Scenario: Edge has own ID and timestamps

- **WHEN** `relate(...)` creates an edge
- **THEN** the returned edge record contains `id`, `createdAt`, and `stability` separate from either endpoint

### Requirement: Pluggable storage adapter

The engine SHALL accept a `StorageAdapter` at construction and delegate all reads and writes to it. The engine SHALL NOT contain storage logic itself.

#### Scenario: Engine works with InMemoryAdapter

- **WHEN** the engine is constructed with an `InMemoryAdapter`
- **THEN** all operations succeed without external dependencies

#### Scenario: Engine works with SqliteAdapter

- **WHEN** the engine is constructed with a `SqliteAdapter` pointing to a file path
- **THEN** records persist after the engine instance is discarded and a new instance is created with the same file

### Requirement: InMemoryAdapter

The package SHALL ship an `InMemoryAdapter` that holds all data in process memory, has zero external dependencies, and is suitable for tests and ephemeral sessions.

#### Scenario: No deps on InMemoryAdapter

- **WHEN** only `InMemoryAdapter` is imported
- **THEN** no file system or network I/O occurs

### Requirement: SqliteAdapter

The package SHALL ship a `SqliteAdapter` backed by `better-sqlite3` targeting Node.js 22 LTS. It SHALL persist records to a file specified at construction time and survive process restarts.

#### Scenario: Records survive restart

- **WHEN** a record is inserted, the process exits, and a new engine is created with the same SQLite file
- **THEN** the record is still retrievable

### Requirement: Embedding metadata on records

Every LtmRecord SHALL carry an `embeddingMeta` field with `modelId: string` and `dimensions: number`. The `SqliteAdapter` schema SHALL include `embedding_model_id TEXT NOT NULL` and `embedding_dimensions INTEGER NOT NULL` columns alongside the embedding BLOB.

#### Scenario: Record insertion stores embedding metadata

- **WHEN** `insert(data, options)` is called
- **THEN** the stored record has `embeddingMeta.modelId` and `embeddingMeta.dimensions` matching the adapter used

#### Scenario: getById returns embedding metadata

- **WHEN** `getById(id)` is called on an existing record
- **THEN** the returned record includes a populated `embeddingMeta` field

### Requirement: WAL mode and synchronous pragma

The `SqliteAdapter` SHALL enable WAL mode at connection time: `journal_mode = WAL` and `synchronous = NORMAL`. This is required to support concurrent readers while a write transaction is open.

#### Scenario: WAL mode is set on connection open

- **WHEN** a new `SqliteAdapter` is instantiated
- **THEN** `PRAGMA journal_mode = WAL` and `PRAGMA synchronous = NORMAL` have been executed before any read or write operation

### Requirement: process_locks table for mutual exclusion

The `SqliteAdapter` schema SHALL include a `process_locks` table with columns `process TEXT PRIMARY KEY`, `acquired_at INTEGER NOT NULL`, and `ttl_ms INTEGER NOT NULL`. The storage adapter SHALL expose `acquireLock(process: string, ttlMs: number): boolean` and `releaseLock(process: string): void`.

#### Scenario: acquireLock returns true when no competing lock exists

- **WHEN** `acquireLock('amygdala', 60000)` is called and no lock row exists
- **THEN** the row is inserted and `true` is returned

#### Scenario: acquireLock returns false when a live lock exists

- **WHEN** another process holds a lock that has not expired
- **THEN** `acquireLock` returns `false` without modifying the existing row

#### Scenario: acquireLock clears stale lock and returns true

- **WHEN** a lock row exists but `now >= acquired_at + ttl_ms`
- **THEN** the stale row is deleted, a new row is inserted, and `true` is returned

#### Scenario: releaseLock deletes own row

- **WHEN** `releaseLock('amygdala')` is called
- **THEN** the row with `process = 'amygdala'` is removed from `process_locks`

### Requirement: FTS5 content virtual table

The `SqliteAdapter` schema init SHALL create a FTS5 content virtual table: `CREATE VIRTUAL TABLE ltm_records_fts USING fts5(data, content='ltm_records', content_rowid='id')`. The `insertRecord` operation SHALL trigger the FTS5 index update. BM25 scoring SHALL NOT be wired into the retrieval pipeline in v1.

#### Scenario: FTS5 table exists after schema init

- **WHEN** a new `SqliteAdapter` is instantiated
- **THEN** the `ltm_records_fts` virtual table exists in the database

#### Scenario: insertRecord updates FTS5 index

- **WHEN** `insertRecord` is called with a new record
- **THEN** the FTS5 index contains the inserted data

### Requirement: Tombstone columns on records table

The `records` table SHALL include `tombstoned INTEGER DEFAULT 0` and `tombstoned_at INTEGER` columns.

#### Scenario: New records have tombstoned = 0

- **WHEN** `insert(data)` is called
- **THEN** the new record has `tombstoned = 0` and `tombstoned_at = null`

### Requirement: Transaction boundaries on multi-step operations

`bulkInsert()`, `delete()`, `consolidate()`, and `prune()` SHALL execute inside explicit SQLite transactions. A failure mid-operation SHALL roll back all changes.

#### Scenario: bulkInsert is fully atomic

- **WHEN** `bulkInsert([...])` fails partway through
- **THEN** no records from the batch are persisted

#### Scenario: consolidate rollback on failure

- **WHEN** `consolidate()` fails after creating the semantic record but before all edges are written
- **THEN** the semantic record and any partial edges are rolled back

### Requirement: getById returns tombstone marker for pruned-but-consolidated records

When `getById(id)` is called for a record that has been tombstoned, it SHALL return `{ id, tombstoned: true, tombstonedAt: Date, data: null }` rather than `null`. `null` SHALL only be returned when the ID has never existed.

#### Scenario: getById distinguishes tombstoned from never-existed

- **WHEN** `getById(id)` is called for a tombstoned record
- **THEN** the return value has `tombstoned: true` and `data: null`

#### Scenario: getById returns null for unknown ID

- **WHEN** `getById(id)` is called for an ID that was never inserted
- **THEN** `null` is returned

### Requirement: query excludes tombstoned records from scoring

`query()` SHALL exclude tombstoned records from the scoring candidate pool. Tombstoned records have no embedding and cannot be scored.

#### Scenario: query does not return tombstoned records

- **WHEN** `query(nlQuery)` is called and some records are tombstoned
- **THEN** no tombstoned record appears in the result set

### Requirement: updateEmbedding on StorageAdapter

The `StorageAdapter` interface SHALL expose `updateEmbedding(id: number, embedding: Float32Array, meta: EmbeddingMeta): void` as distinct from `updateMetadata`. This method is used by the `reembedAll` migration utility.

#### Scenario: updateEmbedding replaces embedding and meta

- **WHEN** `updateEmbedding(id, newVec, newMeta)` is called
- **THEN** the stored embedding and embeddingMeta are updated; the record data is unchanged

### Requirement: getAllRecords on StorageAdapter

The `StorageAdapter` interface SHALL expose `getAllRecords(): LtmRecord[]` to support brute-force cosine scan during query.

#### Scenario: getAllRecords returns all non-tombstoned records

- **WHEN** `getAllRecords()` is called with 5 live records and 2 tombstoned records
- **THEN** 5 records are returned; tombstoned records are excluded
