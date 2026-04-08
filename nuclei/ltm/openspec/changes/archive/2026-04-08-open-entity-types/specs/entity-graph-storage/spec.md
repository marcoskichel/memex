## MODIFIED Requirements

### Requirement: EntityNode and EntityEdge types

`EntityNode` SHALL be defined as `{ id: number; name: string; type: string; embedding: Float32Array; createdAt: Date }`. `EntityEdge` SHALL be defined as `{ id: number; fromId: number; toId: number; type: string; createdAt: Date }`. Both types SHALL be exported from `@neurome/entorhinal` and re-used by `@neurome/ltm`. The `type` field on both types is `string` (open), not a closed union.

#### Scenario: EntityNode fields are fully typed

- **WHEN** a consumer imports `EntityNode` from `@neurome/ltm`-typed APIs
- **THEN** all five fields (`id`, `name`, `type`, `embedding`, `createdAt`) are available with their declared types, with `type` typed as `string`

#### Scenario: EntityNode with a novel type string is accepted at storage layer

- **WHEN** `adapter.insertEntity({ name: 'Settings', type: 'screen', embedding: new Float32Array([0.1, 0.2]), createdAt: new Date() })` is called
- **THEN** an integer id greater than 0 is returned and the entity is retrievable with `type === 'screen'`
