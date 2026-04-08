## Why

The entity deduplication logic silently creates duplicate graph nodes when an entity is
extracted with a different type than its existing counterpart. A `candidate.type ===
extracted.type` hard gate in `entity-resolver.ts` rejects candidates before the LLM can
even evaluate them. Combined with a closed enum that excludes domain-relevant types like
`screen`, the entity graph is structurally broken for UI-navigation agents.

## What Changes

- **BREAKING** `EntityType` widened from closed union to `string` (in `@neurome/entorhinal`,
  referenced here)
- Remove `candidate.type === extracted.type` gates from `resolveEntityIdentity` in
  `entity-resolver.ts`; type mismatch becomes a signal passed to the LLM, not a hard reject
- Update extraction LLM schema: remove `enum` restriction on `type` field; replace with a
  `description` listing suggested types
- Suggested types: `person`, `project`, `concept`, `preference`, `decision`, `tool`, `screen`
- Add `navigates_to` as a suggested edge `relationshipType` in the extraction prompt
  (replaces the idea of a `navigation_action` entity type)
- Add type normalization: lowercase + trim all extracted entity type strings before any
  comparison or persistence
- Update deduplication prompt to state that type mismatch alone is not sufficient reason
  to return `distinct`

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `entity-extraction-process`: deduplication type gate behavior changes; extraction schema
  changes; type normalization added

## Impact

- `src/core/entity-resolver.ts` — remove type equality gates
- `src/shell/clients/extraction-client.ts` — schema enum removed, description added,
  type normalization added, dedup prompt updated
- `src/core/types.ts` — `EntityType` becomes `string` (via `@neurome/entorhinal`)
- Tests that assert `distinct` for type-mismatched entities need updating
