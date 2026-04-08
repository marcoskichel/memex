## ADDED Requirements

### Requirement: LtmEngine insert and semantic query round-trip

The e2e script SHALL insert records via `LtmEngine.insert()` with real `OpenAIEmbeddingAdapter` and assert that `LtmEngine.query()` returns semantically similar records above the similarity threshold.

#### Scenario: Inserted record is retrievable by semantic query

- **WHEN** a record is inserted with a descriptive text string
- **THEN** querying with a semantically similar phrase returns that record with `effectiveScore > 0`

#### Scenario: Unrelated record does not appear in query results

- **WHEN** two records with unrelated topics are inserted
- **THEN** querying with a phrase specific to one record does not return the other record in top results

### Requirement: LtmEngine relate and edge traversal

The e2e script SHALL create edges between records via `LtmEngine.relate()` and assert the edge is stored by retrieving both records and checking metadata.

#### Scenario: Relate creates a traversable edge

- **WHEN** two records exist and `relate({ fromId, toId, type })` is called
- **THEN** the returned edge ID is positive and both records remain retrievable via `getById`

### Requirement: LtmEngine findEntityPath graph traversal

The e2e script SHALL insert records with entity metadata, create entity edges in the storage graph, and assert that `LtmEngine.findEntityPath()` returns the correct path between two entities.

#### Scenario: findEntityPath returns path between connected entities

- **WHEN** entity A and entity B are connected via entity C in the graph (A → C → B)
- **THEN** `findEntityPath({ fromEntityId, toEntityId })` returns a path of length 3 with nodes in the correct order

#### Scenario: findEntityPath returns empty for unconnected entities

- **WHEN** entity A and entity B have no graph path between them
- **THEN** `findEntityPath({ fromEntityId, toEntityId })` returns an empty array

### Requirement: LtmEngine consolidate merges and tombstones sources

The e2e script SHALL insert episodic source records, call `LtmEngine.consolidate()`, and assert that source records are tombstoned and the resulting semantic record is queryable.

#### Scenario: Consolidation tombstones source records

- **WHEN** two episodic records are consolidated into a semantic summary
- **THEN** both source records are marked as tombstoned (retrievable via `getById` with `tombstoned: true`)
- **AND** the consolidated record is queryable via `LtmEngine.query()` and returns a result with `tier: "semantic"`

### Requirement: LtmEngine prune removes decayed records

The e2e script SHALL insert a record with parameters that guarantee retention below the prune threshold and assert that `LtmEngine.prune()` removes it.

#### Scenario: Prune removes record below retention threshold

- **WHEN** a record is inserted with `importance: 0`, zero access count, and a very old `lastAccessedAt`
- **THEN** calling `LtmEngine.prune()` returns `pruned >= 1`
- **AND** the record is no longer returned by `LtmEngine.query()`

### Requirement: LtmEngine decay events fire on strengthening query

The e2e script SHALL attach a listener to the engine's `EventTarget`, insert a record with low stability, run a query with `strengthen: true`, and assert the decay event fires if retention is below threshold.

#### Scenario: Decay event fires for low-retention record

- **WHEN** a record with low stability is queried with `strengthen: true`
- **AND** the record's computed retention value is below the decay threshold
- **THEN** a `ltm:record:decayed-below-threshold` event is dispatched with the record's `id` and `retention` value

### Requirement: LtmEngine stats reflect inserted records

The e2e script SHALL assert that `LtmEngine.stats()` returns accurate counts after insertions and pruning.

#### Scenario: Stats reflect current record counts

- **WHEN** N records have been inserted and M have been pruned
- **THEN** `LtmEngine.stats()` returns counts consistent with N - M live records
