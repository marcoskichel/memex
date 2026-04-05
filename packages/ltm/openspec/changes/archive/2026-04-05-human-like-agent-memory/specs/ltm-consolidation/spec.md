## ADDED Requirements

### Requirement: Consolidation candidate discovery

The engine SHALL provide `findConsolidationCandidates({ similarityThreshold?, minAccessCount? })` that groups episodic records into clusters where each pair within a cluster has a cosine similarity above `similarityThreshold` (default `0.75`) and each record meets `minAccessCount` (default `2`). Each cluster SHALL be returned as an `EngramRecord[]`.

#### Scenario: Similar records form a cluster

- **WHEN** three episodic records have pairwise cosine similarity above the threshold and each has been accessed at least twice
- **THEN** they appear together in a single returned cluster

#### Scenario: Dissimilar records are in separate clusters

- **WHEN** two episodic records have cosine similarity below the threshold
- **THEN** they do not share a cluster

#### Scenario: Low-access records are excluded

- **WHEN** an episodic record has `accessCount` below `minAccessCount`
- **THEN** it does not appear in any cluster

#### Scenario: Semantic records are excluded from candidates

- **WHEN** a record has `tier: 'semantic'`
- **THEN** it does not appear in any cluster regardless of similarity

### Requirement: Consolidation creates a semantic record

`consolidate(sourceIds[], data, options?)` SHALL create a new record with `tier: 'semantic'`, importance equal to the maximum importance among source records, and stability equal to `max(source stabilities) × 1.5`.

#### Scenario: Consolidated record has semantic tier

- **WHEN** `consolidate(sourceIds, data)` is called
- **THEN** the new record has `tier: 'semantic'`

#### Scenario: Consolidated importance is max of sources

- **WHEN** source records have importances `[0.4, 0.7, 0.5]`
- **THEN** the new record's importance is `0.7`

#### Scenario: Consolidated stability is max times 1.5

- **WHEN** source records have stabilities `[3, 8, 5]` days
- **THEN** the new record's stability is `8 × 1.5 = 12` days

### Requirement: Consolidation edges

`consolidate()` SHALL create a `consolidates` edge from the new semantic record to each source record.

#### Scenario: Consolidates edges are created

- **WHEN** `consolidate([id1, id2], data)` is called
- **THEN** `consolidates` edges exist from the new record to `id1` and to `id2`

### Requirement: Source stability deflation

When `deflateSourceStability: true` (the default), `consolidate()` SHALL divide each source record's current stability by `2` to accelerate their natural decay.

#### Scenario: Source stability halved on consolidation

- **WHEN** `consolidate(sourceIds, data)` is called with default options and a source has stability `8`
- **THEN** that source's stability becomes `4`

#### Scenario: deflateSourceStability false leaves sources unchanged

- **WHEN** `consolidate(sourceIds, data, { deflateSourceStability: false })` is called
- **THEN** no source record's stability is modified

### Requirement: Source records are not deleted

`consolidate()` SHALL NOT delete source records. They SHALL remain in the store and decay naturally until removed by `prune()`.

#### Scenario: Source records still retrievable after consolidation

- **WHEN** `consolidate(sourceIds, data)` is called
- **THEN** each source record is still retrievable by ID

### Requirement: Pruning by retention threshold

`prune({ minRetention?, tier? })` SHALL remove all records whose current retention is below `minRetention` (default `0.1`) and return `{ pruned: number; remaining: number }`.

#### Scenario: Records below threshold are removed

- **WHEN** `prune()` is called and two records have retention below `0.1`
- **THEN** both are deleted and `pruned` equals 2

#### Scenario: Records above threshold are kept

- **WHEN** a record's retention is above `minRetention`
- **THEN** it is not removed and appears in `remaining`

#### Scenario: Tier filter restricts pruning scope

- **WHEN** `prune({ tier: 'episodic' })` is called
- **THEN** only episodic records are candidates for removal; semantic records are untouched

#### Scenario: Pruning cascades edge deletion

- **WHEN** a record is pruned
- **THEN** all edges where it is the `fromId` or `toId` are also deleted

### Requirement: Engine stats

`stats()` SHALL return an `EngineStats` object containing `total`, `episodic`, `semantic`, `avgStability`, and `avgRetention` computed across all stored records at call time.

#### Scenario: Stats reflect current store state

- **WHEN** `stats()` is called after inserting 3 episodic and 1 semantic record
- **THEN** `total` is 4, `episodic` is 3, `semantic` is 1

#### Scenario: avgRetention is computed at call time

- **WHEN** `stats()` is called on records with varying decay
- **THEN** `avgRetention` is the mean of current retention values across all records

### Requirement: Confidence-adjusted stability for consolidated records

`consolidate()` SHALL accept `confidence?: number` (default `1.0`), `preservedFacts?: string[]`, and `uncertainties?: string[]` in its options. The initial stability of the semantic record SHALL be `max(source stabilities) × (1.0 + confidence × 0.5)`.

#### Scenario: Full confidence produces 1.5× multiplier

- **WHEN** `consolidate(sourceIds, data, { confidence: 1.0 })` is called with max source stability 8
- **THEN** the semantic record's stability is 12 (8 × 1.5)

#### Scenario: Zero confidence produces 1.0× multiplier

- **WHEN** `consolidate(sourceIds, data, { confidence: 0.0 })` is called with max source stability 8
- **THEN** the semantic record's stability is 8 (8 × 1.0)

#### Scenario: Default confidence is 1.0

- **WHEN** `consolidate(sourceIds, data)` is called with no options
- **THEN** the stability multiplier is 1.5 (unchanged from prior behavior)

### Requirement: Confidence metadata stored on semantic record

`consolidate()` SHALL store `confidence`, `preservedFacts`, and `uncertainties` in the semantic record's metadata alongside `consolidatedAt` and `sourceIds`.

#### Scenario: Semantic record metadata includes confidence

- **WHEN** `consolidate(sourceIds, data, { confidence: 0.7, preservedFacts: ['fact A'] })` is called
- **THEN** the semantic record's metadata has `confidence: 0.7` and `preservedFacts: ['fact A']`

### Requirement: Tombstone episodic records on prune when consolidated

When `prune()` removes an episodic record that is referenced as a `toId` by any `consolidates` edge, it SHALL tombstone the record (`data = null`, `embedding = null`, `tombstoned = 1`, `tombstoned_at = now`) rather than fully deleting it. Episodic records with no `consolidates` back-reference SHALL be fully deleted.

#### Scenario: Consolidated episodic is tombstoned not deleted

- **WHEN** `prune()` removes an episodic record that has a `consolidates` edge pointing to it
- **THEN** the record row remains with `tombstoned = 1`, `data = null`, `embedding = null`

#### Scenario: Unconsolidated episodic is fully deleted

- **WHEN** `prune()` removes an episodic record with no `consolidates` back-reference
- **THEN** the record row is removed entirely from the `records` table
