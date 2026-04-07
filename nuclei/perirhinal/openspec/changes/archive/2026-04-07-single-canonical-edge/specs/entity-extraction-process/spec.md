## MODIFIED Requirements

### Requirement: buildEntityInsertPlan produces a pure insert plan from resolved identities

`buildEntityInsertPlan(resolutions: EntityResolution[], edges: ExtractedEdge[])` SHALL return an `EntityInsertPlan` with: `toInsert: ExtractedEntity[]` (new nodes), `toReuse: { extracted: ExtractedEntity; entityId: number }[]` (merged nodes), `edgesToInsert: ExtractedEdge[]`, and `llmNeeded: { extracted: ExtractedEntity; candidates: EntityNode[] }[]`. Edges in `edgesToInsert` are passed through as-is; deduplication of edges against the existing graph is the responsibility of the storage layer.

#### Scenario: Distinct entities go to toInsert

- **WHEN** an extracted entity resolves as `{ type: 'distinct' }`
- **THEN** it appears in `plan.toInsert`

#### Scenario: Merged and exact entities go to toReuse

- **WHEN** an extracted entity resolves as `{ type: 'merge', entityId: 5 }` or `{ type: 'exact', entityId: 5 }`
- **THEN** it appears in `plan.toReuse` with `entityId: 5`

#### Scenario: LLM-needed entities are surfaced for caller

- **WHEN** an extracted entity resolves as `{ type: 'llm-needed', candidates: [...] }`
- **THEN** it appears in `plan.llmNeeded`

#### Scenario: Duplicate edge across two records produces one graph edge

- **WHEN** record A causes `persistInsertPlan` to write edge `Maya → Atlas [leads]`
- **WHEN** record B also causes `persistInsertPlan` to write edge `Maya → Atlas [leads]`
- **THEN** only one `entity_edges` row exists for the `Maya → Atlas [leads]` triple
