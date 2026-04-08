## Context

After `extract-entorhinal-types`, `EntityType` lives in `@neurome/entorhinal`. It is
still a closed string union. The only change needed in ltm is to widen that type to
`string` and ensure `LtmQueryOptions.entityType` accepts the wider type.

## Goals / Non-Goals

**Goals:**

- Widen `EntityType` to `string` in `@neurome/entorhinal`
- Confirm no ltm query logic breaks (the filter is a string comparison already)

**Non-Goals:**

- Changing query ranking, scoring, or any other LTM behavior

## Decisions

**`EntityType = string`, not a wider union:**
Adding known types to the union (`'screen' | 'person' | ...`) would require updating
the union every time a new domain introduces new types. Since the entity extraction side
is now open (free-form), the storage/query side must accept any string. A type alias
`export type EntityType = string` preserves the named concept while being maximally open.

**No migration of existing stored rows:**
Rows with type `concept` remain `concept`. No backfill needed. The deduplication fix
in perirhinal handles the forward-looking reconciliation.

## Risks / Trade-offs

- [Risk] TypeScript loses enum-exhaustiveness checks on `EntityType` where they exist →
  Mitigation: grep for any switch/if-else on `EntityType` values; there are none in ltm
  (the type is used only as a filter string and a stored field)
