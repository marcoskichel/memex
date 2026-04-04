## Why

The amygdala's write path must be updated to populate the three new LTM record fields (`sessionId`, `episodeSummary`, and the context file `safeToDelete` timing change) introduced in the `ltm-schema-extensions` change to `@memex/ltm`.

## What Changes

- Amygdala reads `sessionId` from `AmygdalaConfig` and writes it to every `LtmRecord` it inserts
- Amygdala writes `InsightEntry.text` as `episodeSummary` on every inserted record
- Context files are marked `safeToDelete = true` immediately after the record is written (not after hippocampus processes it)
- `AmygdalaConfig` gains required `sessionId: string` field

## Capabilities

### New Capabilities

_(none — this scope only extends existing write behaviour)_

### Modified Capabilities

- `amygdala-scoring`: write path extended to populate `sessionId` and `episodeSummary`; `safeToDelete` timing moved earlier

## Impact

- `packages/amygdala`: `amygdala-schema.ts` (config type), `amygdala-process.ts` (applyAction write path)
- Requires `@memex/ltm` `ltm-schema-extensions` to be merged first
