# open-entity-types

## What

Widen `EntityType` from a closed string union to a free-form `string` with a
suggested set of well-known types. Remove the hard type-equality gate in entity
deduplication that silently creates duplicate graph nodes when entity types differ.
Add `screen` to the suggested types list. Replace the idea of a `navigation_action`
entity type with the `navigates_to` edge relationship type (navigation is a relationship
between screen entities, not an entity itself).

## Why

The current closed enum (`person | project | concept | preference | decision | tool`)
is wrong for any agent working in a UI/mobile context. Every screen becomes `concept`
or is unrepresented. More importantly, the deduplication logic in `entity-resolver.ts`
uses a `candidate.type === extracted.type` hard gate — if a screen was previously stored
as `concept` and later extracted as `screen`, it never reaches the LLM deduplication
step and a duplicate node is silently inserted.

## Scopes

- **nuclei/perirhinal** — widen `EntityType`, remove type gate in `entity-resolver.ts`,
  update extraction schema/prompt, add type normalization, update dedup prompt
- **nuclei/ltm** — widen `EntityType` in `@neurome/entorhinal` (the canonical source
  after `extract-entorhinal-types` is applied); update `LtmQueryOptions.entityType`
  filter to accept `string`

## Dependency

**Requires:** `extract-entorhinal-types` — `EntityType` must be in `@neurome/entorhinal`
before it can be safely widened in one place. Applying this change before
`extract-entorhinal-types` means patching `EntityType` in two separate packages.

**Blocks:** nothing downstream currently.

## Key decisions captured here

1. `EntityType` → `string` (not a wider union, not a branded type)
2. Suggested types in extraction prompt: `person`, `project`, `concept`, `preference`,
   `decision`, `tool`, `screen` — plus `navigates_to` as a suggested **edge** type
3. `navigation_action` entity type dropped; navigation expressed as edges
4. Type normalization: extracted type strings lowercased + trimmed before persistence
5. Dedup type gate removed: type mismatch is a signal to the LLM, not a hard reject
