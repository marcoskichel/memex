## Why

`@neurome/ltm` and `@neurome/memory` have comprehensive unit tests with mocked dependencies but no end-to-end validation against real storage and services. Two critical gaps exist:

1. **`ltm`** is the foundational layer that all upper-tier packages (amygdala, hippocampus, perirhinal) rely on. Bugs here propagate silently upward. `findEntityPath` (just added) has zero real-world validation. The query pipeline — cosine similarity ranking, RRF merge, entity-ranked filtering, decay — is untested against real SQLite + real embeddings.

2. **`memory`** is the full orchestration layer. Even with per-engine e2e tests, the wiring between components (`createMemory`, `importText`, `recall`, event propagation, `PendingConsolidationStore`) has no integration coverage. The `importText → recall` round-trip is a core user-facing flow with no real-world validation.

## What Changes

### `@neurome/ltm`

- Add `scripts/e2e.ts`: exercises `LtmEngine` with real `OpenAIEmbeddingAdapter` + real `SqliteAdapter`
- Scenarios: insert, semantic query, relate + graph traversal, findEntityPath, consolidate, prune, decay
- **No LLM required** — deterministic assertions throughout (no soft-warns)

### `@neurome/memory`

- Add `scripts/e2e.ts`: exercises `createMemory()` with real Anthropic LLM + OpenAI embeddings + SqliteAdapter
- Scenarios: `importText → recall` round-trip, `logInsight → recall`, `insertMemory`, stats, shutdown
- Validates orchestration wiring not covered by individual engine e2e tests

## Scopes

- `nuclei/ltm` — per-scope change: `add-e2e-tests`
- `nuclei/memory` — per-scope change: `add-e2e-tests`

## Shared Contracts

Both scripts follow the perirhinal pattern:

- Standalone `scripts/e2e.ts` with real APIs
- Temp SQLite DB via `tmpdir()`, cleaned up on exit
- `dotenv-cli` + `tsx` for invocation via `pnpm run e2e`
- Hard `throw` on mechanical guarantees; `console.warn` on LLM judgment calls (memory only)
- No CI integration — explicit `pnpm run e2e` invocation only
