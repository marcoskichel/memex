## ADDED Requirements

### Requirement: resolveEntityIdentity applies type-first deduplication logic

`resolveEntityIdentity(extracted: ExtractedEntity, candidates: EntityNode[])` SHALL return an `EntityResolution` discriminated union. Rules applied in order:

1. If any candidate has the same normalized name → `{ type: 'exact', entityId: number }`
2. For each candidate with cosine similarity ≥ 0.85: if entity types differ → skip; if types match → `{ type: 'merge', entityId: number }`
3. For each candidate with cosine similarity in [0.70, 0.85): if types differ → skip; if types match → `{ type: 'llm-needed', candidates: EntityNode[] }`
4. Otherwise → `{ type: 'distinct' }`

#### Scenario: Exact name match resolves without embedding check

- **WHEN** `resolveEntityIdentity` is called with a candidate whose normalized name matches the extracted entity name
- **THEN** result is `{ type: 'exact', entityId: <candidate id> }` regardless of cosine similarity

#### Scenario: Same type, cosine >= 0.85 merges without LLM

- **WHEN** extracted entity type is `'person'` and a candidate has type `'person'` with cosine similarity 0.92
- **THEN** result is `{ type: 'merge', entityId: <candidate id> }`

#### Scenario: Different types at cosine 0.82 are treated as distinct

- **WHEN** extracted entity type is `'person'` and the only candidate has type `'project'` with cosine similarity 0.82
- **THEN** result is `{ type: 'distinct' }`

#### Scenario: Same type, cosine in ambiguous band requires LLM

- **WHEN** extracted entity type is `'person'` and a candidate has type `'person'` with cosine similarity 0.78
- **THEN** result is `{ type: 'llm-needed', candidates: [<the candidate>] }`

#### Scenario: No candidates above threshold resolves as distinct

- **WHEN** no candidate exceeds the 0.70 minimum cosine threshold
- **THEN** result is `{ type: 'distinct' }`

### Requirement: buildEntityInsertPlan produces a pure insert plan from resolved identities

`buildEntityInsertPlan(resolutions: EntityResolution[], edges: ExtractedEdge[])` SHALL return an `EntityInsertPlan` with: `toInsert: ExtractedEntity[]` (new nodes), `toReuse: { extracted: ExtractedEntity; entityId: number }[]` (merged nodes), `edgesToInsert: ExtractedEdge[]`, and `llmNeeded: { extracted: ExtractedEntity; candidates: EntityNode[] }[]`.

#### Scenario: Distinct entities go to toInsert

- **WHEN** an extracted entity resolves as `{ type: 'distinct' }`
- **THEN** it appears in `plan.toInsert`

#### Scenario: Merged and exact entities go to toReuse

- **WHEN** an extracted entity resolves as `{ type: 'merge', entityId: 5 }` or `{ type: 'exact', entityId: 5 }`
- **THEN** it appears in `plan.toReuse` with `entityId: 5`

#### Scenario: LLM-needed entities are surfaced for caller

- **WHEN** an extracted entity resolves as `{ type: 'llm-needed', candidates: [...] }`
- **THEN** it appears in `plan.llmNeeded`

### Requirement: EntityExtractionProcess processes unlinked records in batches

`EntityExtractionProcess` SHALL poll for `LtmRecord` rows that have `metadata.entities` populated but no corresponding `entity_record_links` rows. It SHALL process them in batches, run the full extraction-deduplication-insert pipeline for each, and create `entity_record_links` rows upon completion. The process SHALL use `StorageAdapter.acquireLock` to prevent concurrent runs.

#### Scenario: Unprocessed record gets entity graph populated

- **WHEN** a record with `metadata.entities: [{ name: 'Alice', type: 'person' }]` has no `entity_record_links` row
- **WHEN** `EntityExtractionProcess` runs
- **THEN** an `EntityNode` exists for Alice, an `entity_record_links` row exists tying Alice's node to the record, and no duplicate node is created for Alice on subsequent runs

#### Scenario: Already-processed record is skipped

- **WHEN** a record already has a corresponding `entity_record_links` row
- **WHEN** `EntityExtractionProcess` runs
- **THEN** no new `EntityNode` or `entity_record_links` rows are created for that record

#### Scenario: Process lock prevents concurrent execution

- **WHEN** `EntityExtractionProcess` holds the lock
- **WHEN** a second instance of `EntityExtractionProcess` attempts to start
- **THEN** the second instance exits without processing any records

### Requirement: LLM confirmation is batched across all ambiguous candidates in a run

Within a single processing batch, all `llm-needed` candidates SHALL be sent to the LLM in a single batched call rather than one call per ambiguous pair. The result SHALL be used to produce final `merge` or `distinct` resolutions before the insert plan is executed.

#### Scenario: Multiple ambiguous pairs produce one LLM call

- **WHEN** a batch contains three entities in the `llm-needed` band
- **THEN** exactly one LLM call is made for the batch, not three

#### Scenario: LLM confirms merge

- **WHEN** the LLM responds that two entities are the same
- **THEN** the extracted entity is added to `toReuse` with the matched candidate's id

#### Scenario: LLM confirms distinct

- **WHEN** the LLM responds that two entities are different
- **THEN** the extracted entity is added to `toInsert` as a new node
