## Why

`@neurome/hippocampus` has comprehensive unit tests with mocked dependencies but no end-to-end validation against real LLM and storage adapters. The consolidation pipeline — embedding-based clustering, LLM summarization, `ltm.consolidate` wiring, temporal splitting, and prune behavior — has no real-world validation.

## What Changes

- Add `scripts/e2e.ts`: a narrative e2e script exercising `HippocampusProcess` with a real Anthropic LLM, real OpenAI embeddings, real `SqliteAdapter`/`LtmEngine`, and in-memory `InsightLog`
- Add `"e2e"` npm script to `package.json` using `dotenv-cli` + `tsx`
- Add `.env.e2e` (gitignored) for `ANTHROPIC_API_KEY` and `OPENAI_API_KEY`
- Add `dotenv-cli` and `tsx` to `devDependencies`

## Capabilities

### New Capabilities

- `hippocampus-e2e`: End-to-end test script covering the full hippocampus consolidation pipeline against real external services

### Modified Capabilities

## Impact

- `nuclei/hippocampus/scripts/e2e.ts` — new file
- `nuclei/hippocampus/package.json` — new `e2e` script + devDeps
- No changes to production source code
