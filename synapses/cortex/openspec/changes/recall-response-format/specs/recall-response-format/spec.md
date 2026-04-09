## ADDED Requirements

### Requirement: Recall results serialized as LLM-optimized entries

The recall IPC handler SHALL serialize each non-superseded, non-companion result as a `MemoryEntry` with fields: `memory` (string), `tier`, `relevance`, `tags` (semantic only), `entities`, `recordedAt` (ISO date, day precision).

#### Scenario: Normal record serialized as MemoryEntry

- **WHEN** a recall result contains a record with `isSuperseded: false` and `retrievalStrategies` not including `'companion'`
- **THEN** the serialized output contains a `MemoryEntry` with `memory` equal to `record.data`, `tier` preserved, and no `rrfScore`, `embeddingMeta`, `accessCount`, `stability`, or `episodeSummary` fields

### Requirement: Hash-format tags stripped from output

The recall serializer SHALL exclude any tag string that matches a 64-character hex pattern from the `tags` array. Only human-readable tags SHALL be forwarded to the LLM.

#### Scenario: Hash tags excluded, semantic tags retained

- **WHEN** a record's `metadata.tags` contains `["navigation", "e746227e08f44f1e42d2226b8025373afa403d38283e578be42aa0d90acca0f2", "Settings"]`
- **THEN** the serialized `tags` field is `["navigation", "Settings"]`

### Requirement: effectiveScore bucketed into relevance label

The recall serializer SHALL convert `effectiveScore` to a `relevance` string: `"high"` when score >= 0.7, `"medium"` when score >= 0.5, `"low"` otherwise.

#### Scenario: High score maps to high relevance

- **WHEN** a record has `effectiveScore: 0.82`
- **THEN** the serialized entry has `relevance: "high"`

#### Scenario: Mid score maps to medium relevance

- **WHEN** a record has `effectiveScore: 0.55`
- **THEN** the serialized entry has `relevance: "medium"`

#### Scenario: Low score maps to low relevance

- **WHEN** a record has `effectiveScore: 0.43`
- **THEN** the serialized entry has `relevance: "low"`

### Requirement: Superseded and companion records grouped as MemoryChange

When a superseded record and its companion are both present in recall results, the serializer SHALL emit a single `MemoryChange` object with `type: "changed"`, `current` set to the companion's `MemoryEntry`, and `supersedes` set to the superseded record's `MemoryEntry`.

#### Scenario: Superseded record paired with its companion

- **WHEN** a recall result contains record A with `isSuperseded: true` and `supersedingIds: [B]`, and record B with `retrievalStrategies: ['companion']`
- **THEN** the serialized output contains one `MemoryChange` with `current.memory` equal to B's data and `supersedes.memory` equal to A's data
- **THEN** neither A nor B appears as a standalone `MemoryEntry`

#### Scenario: Companion record not emitted standalone

- **WHEN** record B has `retrievalStrategies: ['companion']` and its superseded counterpart A is also in the result set
- **THEN** record B does not appear as a top-level `MemoryEntry` in the output

### Requirement: Superseded record with no companion in results emitted standalone

If a superseded record's companion is not present in the result set, the serializer SHALL emit the superseded record as a standalone `MemoryEntry` with an additional `superseded: true` field.

#### Scenario: Superseded with missing companion emitted with flag

- **WHEN** a recall result contains a record with `isSuperseded: true` but no companion record is present in the result set
- **THEN** the serialized output contains a `MemoryEntry` with `superseded: true`

### Requirement: Multiple companions — first companion used

When a superseded record has multiple entries in `supersedingIds`, the serializer SHALL pair it with the first companion found in the result set.

#### Scenario: First matching companion used for grouping

- **WHEN** a record has `supersedingIds: [10, 11]` and both records 10 and 11 are present as companions
- **THEN** the `MemoryChange.current` is set to the entry with the lower ID (first injected)
