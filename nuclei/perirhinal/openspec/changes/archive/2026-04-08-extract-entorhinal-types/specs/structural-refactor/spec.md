## ADDED Requirements

### Requirement: EntityType imported from @neurome/entorhinal

`@neurome/perirhinal` SHALL import `EntityType` and `EntityMention` from
`@neurome/entorhinal` rather than defining them locally. The `ExtractedEntity.type`
field SHALL be typed as `EntityType` from `@neurome/entorhinal` with no unsafe cast.

#### Scenario: ExtractedEntity type is assignable to EntityType without cast

- **WHEN** the extraction LLM returns `{ name: 'Settings', type: 'screen' }`
- **THEN** the resulting `ExtractedEntity.type` is assignable to `EntityType` from
  `@neurome/entorhinal` without an explicit type cast
