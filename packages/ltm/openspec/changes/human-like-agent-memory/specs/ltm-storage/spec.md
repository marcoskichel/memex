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
