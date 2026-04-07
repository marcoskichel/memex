## Why

The amygdala already makes one LLM call per observation. Bundling entity extraction into that same call adds structured entity mentions to every scored record at zero extra LLM round-trip cost.

## What Changes

- Extend `AmygdalaScoringResult` with `entities: EntityMention[]` (imported from `@neurome/cortex-ipc`)
- Update `amygdalaScoringSchema` to include the `entities` array field in the structured output shape
- Update `SYSTEM_PROMPT` to instruct the LLM to extract named entities alongside the scoring decision
- Update `buildPrompt` / `buildPromptWithContext` if needed for prompt clarity

## Capabilities

### New Capabilities

_(none — entity extraction is added to an existing capability)_

### Modified Capabilities

- `amygdala-scoring`: The scoring result now includes an `entities` field with extracted entity mentions

## Impact

- `nuclei/amygdala/src/amygdala-schema.ts` — `AmygdalaScoringResult`, `amygdalaScoringSchema`, `SYSTEM_PROMPT`
- Downstream: `AmygdalaProcess` passes entity mentions through to the LTM insert call; LTM stores them in `metadata.entities`
- Adds `@neurome/cortex-ipc` as a dependency of `@neurome/amygdala`
