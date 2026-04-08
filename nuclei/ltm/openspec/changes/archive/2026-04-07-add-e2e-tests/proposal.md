## Why

`@neurome/ltm` has comprehensive unit tests with mocked storage and embedding adapters but no end-to-end validation against real SQLite and real embeddings. The query pipeline (cosine similarity, RRF merge, entity ranking, decay), graph traversal (`findEntityPath`), and consolidation mechanics have no real-world coverage — bugs at the integration boundary would only surface in production.

## What Changes

- Add `scripts/e2e.ts`: a narrative e2e script exercising `LtmEngine` with real `OpenAIEmbeddingAdapter` and real `SqliteAdapter`
- Add `"e2e"` npm script to `package.json` using `dotenv-cli` + `tsx`
- Add `.env.e2e` (gitignored) for `OPENAI_API_KEY`
- Add `dotenv-cli` and `tsx` to `devDependencies`

## Capabilities

### New Capabilities

- `ltm-e2e`: End-to-end test script covering the full LtmEngine pipeline against real embeddings and SQLite storage

### Modified Capabilities

## Impact

- `nuclei/ltm/scripts/e2e.ts` — new file
- `nuclei/ltm/package.json` — new `e2e` script + devDeps
- No changes to production source code
