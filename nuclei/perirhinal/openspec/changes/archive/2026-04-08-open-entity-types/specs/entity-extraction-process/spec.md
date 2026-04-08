<!-- DELTA SPEC: This file patches the existing spec at
     nuclei/perirhinal/openspec/specs/entity-extraction-process/spec.md.
     Requirements not listed here (buildEntityInsertPlan, EntityExtractionProcess
     batching, lock behavior) are unchanged and remain in force from the base spec. -->

## MODIFIED Requirements

### Requirement: resolveEntityIdentity applies similarity-first deduplication logic

`resolveEntityIdentity(extracted: ExtractedEntity, candidates: EntityNode[])` SHALL
return an `EntityResolution` discriminated union. Rules applied in order:

1. If any candidate has the same normalized name → `{ type: 'exact', entityId: number }`
2. For each candidate with cosine similarity ≥ 0.85 → `{ type: 'merge', entityId: number }`
   (type equality is NOT required; similarity alone is sufficient at this threshold)
3. For each candidate with cosine similarity in [0.70, 0.85) →
   `{ type: 'llm-needed', candidates: EntityNode[] }`
   (type equality is NOT required; type mismatch is passed as context to the LLM)
4. Otherwise → `{ type: 'distinct' }`

#### Scenario: Exact name match resolves without embedding check

- **WHEN** `resolveEntityIdentity` is called with a candidate whose normalized name matches the extracted entity name
- **THEN** result is `{ type: 'exact', entityId: <candidate id> }` regardless of cosine similarity

#### Scenario: Same type, cosine >= 0.85 merges without LLM

- **WHEN** extracted entity type is `'screen'` and a candidate has type `'screen'` with cosine similarity 0.92
- **THEN** result is `{ type: 'merge', entityId: <candidate id> }`

#### Scenario: Different types at cosine >= 0.85 still merges

- **WHEN** extracted entity type is `'screen'` and the only candidate has type `'concept'` with cosine similarity 0.90
- **THEN** result is `{ type: 'merge', entityId: <candidate id> }` (type mismatch does not block merge at high similarity)

#### Scenario: Different types in ambiguous band require LLM

- **WHEN** extracted entity type is `'screen'` and the only candidate has type `'concept'` with cosine similarity 0.78
- **THEN** result is `{ type: 'llm-needed', candidates: [<the candidate>] }` (LLM decides, not type gate)

#### Scenario: No candidates above threshold resolves as distinct

- **WHEN** no candidate exceeds the 0.70 minimum cosine threshold
- **THEN** result is `{ type: 'distinct' }`

## ADDED Requirements

### Requirement: Extracted entity type strings are normalized before use

The extraction client SHALL lowercase and trim every entity `type` string returned by
the LLM before passing it downstream. No uppercase or whitespace-padded type strings
SHALL enter the entity resolution or storage pipeline.

#### Scenario: LLM returns mixed-case type

- **WHEN** the LLM returns `{ name: 'Settings', type: 'Screen' }`
- **THEN** the resulting `ExtractedEntity.type` is `'screen'`

### Requirement: Extraction schema uses suggested types, not an enum

The extraction LLM schema SHALL NOT use an `enum` constraint on the entity `type` field.
Instead it SHALL use a `description` field listing suggested types including at minimum:
`person`, `project`, `concept`, `preference`, `decision`, `tool`, `screen`. The LLM MAY
return any string value for `type`.

#### Scenario: LLM returns an unlisted type without error

- **WHEN** the extraction LLM returns `{ name: 'Biometric Login', type: 'feature' }`
- **THEN** the entity is accepted and processed normally with type `'feature'`

### Requirement: navigates_to suggested as edge relationship type

The extraction prompt description for edge `relationshipType` SHALL include `navigates_to`
in its suggested list of relationship types, positioning it as the standard way to express
navigation paths between screens.

#### Scenario: Navigation between screens produces an edge, not a navigation_action entity

- **WHEN** the agent records "tapping the sidebar opens the Settings screen"
- **THEN** the extracted result contains a `navigates_to` edge between two `screen` entities,
  not a `navigation_action` entity node
