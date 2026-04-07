## Why

Entity names extracted by the amygdala are stored inconsistently — "Alice", "alice", and "Alice Smith" are treated as distinct entities — fragmenting the entity index and making entity-filtered queries unreliable.

## What Changes

- Update amygdala system prompt to instruct the LLM to use the most complete, canonical form of entity names (prefer "Alice Smith" over "Alice", use role-based names only when proper name is unknown)
- Normalize extracted entity names to lowercase in `parseEntities` before storing, so the entity index is case-insensitive by construction

## Capabilities

### New Capabilities

- `entity-normalization`: Ensures entity names are stored in a consistent, canonical, lowercase form; eliminates case and alias drift across observations

### Modified Capabilities

- `amygdala-scoring`: Entity extraction output now always produces lowercase `name` values; consumers reading `metadata.entities` from LTM records will see normalized names

## Impact

- `src/amygdala-schema.ts` — system prompt text and `parseEntities` function
- Downstream: all LTM records written after this change will have lowercase entity names; existing records are unaffected (query-side already does `toLowerCase()` so no regression)
