## ADDED Requirements

### Requirement: Record insertion
The engine SHALL accept free-form text and arbitrary metadata, compute an embedding for the text, assign a monotonically increasing integer ID, and store the record in memory.

#### Scenario: Single insert returns new ID
- **WHEN** `insert(data, metadata)` is called
- **THEN** a unique positive integer ID is returned and the record is retrievable

#### Scenario: Bulk insert returns ordered IDs
- **WHEN** `bulkInsert([...])` is called with N records
- **THEN** an array of N IDs is returned in the same order as input

### Requirement: Record update
The engine SHALL allow updating the text and/or metadata of an existing record. Updating text SHALL recompute the embedding.

#### Scenario: Updating data recomputes embedding
- **WHEN** `update(id, { data: newText })` is called
- **THEN** the stored embedding is replaced with the embedding of `newText`

#### Scenario: Updating unknown ID returns false
- **WHEN** `update` is called with an ID that does not exist
- **THEN** the method returns `false` and no state changes

### Requirement: Record deletion
The engine SHALL remove a record by ID. Deleting a non-existent ID SHALL return `false`.

#### Scenario: Delete existing record
- **WHEN** `delete(id)` is called for an existing record
- **THEN** returns `true` and the record is no longer retrievable

#### Scenario: Delete non-existent record
- **WHEN** `delete(id)` is called for an unknown ID
- **THEN** returns `false`

### Requirement: Cosine-similarity query
The engine SHALL accept a natural language query string, compute its embedding, and return all records whose cosine similarity to the query meets or exceeds a configurable threshold, sorted descending by similarity.

#### Scenario: Results meet threshold
- **WHEN** `query(nlQuery, threshold)` is called
- **THEN** only records with cosine similarity ≥ threshold are returned

#### Scenario: Results are sorted by similarity
- **WHEN** multiple records match
- **THEN** results are ordered from highest to lowest similarity

### Requirement: Heuristic amount filter
The engine SHALL parse "above $N" from the query and exclude records whose `metadata.amount` is ≤ N or missing.

#### Scenario: Amount filter excludes low-value records
- **WHEN** query contains "above $100" and a record has `amount: 50`
- **THEN** that record is excluded from results

### Requirement: Heuristic time filter
The engine SHALL parse "last week" from the query and exclude records whose `metadata.timestamp` falls outside the past 7 days.

#### Scenario: Time filter excludes old records
- **WHEN** query contains "last week" and a record has a timestamp older than 7 days
- **THEN** that record is excluded from results

#### Scenario: Time filter excludes records without timestamp
- **WHEN** query contains "last week" and a record has no `timestamp` in metadata
- **THEN** that record is excluded from results
