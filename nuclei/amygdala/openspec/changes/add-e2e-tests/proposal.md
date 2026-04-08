## Why

`@neurome/amygdala` has comprehensive unit tests with mocked dependencies but no end-to-end validation against real LLM and storage adapters. Bugs at the integration boundary — prompt engineering regressions, LtmEngine wiring, scoring schema mismatches — would only surface in production.

## What Changes

- Add `scripts/e2e.ts`: a narrative e2e script exercising `AmygdalaProcess` with a real Anthropic LLM, real OpenAI embeddings, real `SqliteAdapter`/`LtmEngine`, and in-memory `InsightLog`
- Add `"e2e"` npm script to `package.json` using `dotenv-cli` + `tsx`
- Add `.env.e2e` (gitignored) for `ANTHROPIC_API_KEY` and `OPENAI_API_KEY`
- Add `dotenv-cli` and `tsx` to `devDependencies`

## Capabilities

### New Capabilities

- `amygdala-e2e`: End-to-end test script covering the full amygdala processing pipeline against real external services

### Modified Capabilities

## Impact

- `nuclei/amygdala/scripts/e2e.ts` — new file
- `nuclei/amygdala/package.json` — new `e2e` script + devDeps
- No changes to production source code
