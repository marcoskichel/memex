## Why

`@neurome/memory` is the top-level orchestration layer that wires amygdala, hippocampus, ltm, and stm together. Individual engine e2e tests (amygdala, hippocampus, perirhinal, ltm) validate each engine in isolation, but the orchestration wiring — `createMemory()`, `importText()`, `recall()`, event propagation, and `PendingConsolidationStore` — has no integration coverage. The `importText → recall` round-trip is a core user-facing flow with no real-world validation.

## What Changes

- Add `scripts/e2e.ts`: a narrative e2e script exercising `createMemory()` with a real Anthropic LLM, real OpenAI embeddings, real `SqliteAdapter`
- Add `"e2e"` npm script to `package.json` using `dotenv-cli` + `tsx`
- Add `.env.e2e` (gitignored) for `ANTHROPIC_API_KEY` and `OPENAI_API_KEY`
- Add `dotenv-cli` and `tsx` to `devDependencies`

## Capabilities

### New Capabilities

- `memory-e2e`: End-to-end test script covering the full memory orchestration pipeline against real external services

### Modified Capabilities

## Impact

- `nuclei/memory/scripts/e2e.ts` — new file
- `nuclei/memory/package.json` — new `e2e` script + devDeps
- No changes to production source code
