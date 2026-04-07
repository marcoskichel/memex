## Why

The extraction pipeline is tested entirely with mocked LLM responses and `InMemoryAdapter`. No test exercises the full stack end-to-end: real LLM extraction, real embeddings, real SQLite storage, and the deduplication resolution paths firing against actual vector similarity. A manually-run script covering realistic scenarios is needed to validate the system behaves correctly before production use.

## What Changes

- Add `scripts/e2e.ts` — a standalone `tsx` script that runs 8 sequential scenarios against a real Anthropic LLM and OpenAI embedding model backed by a fresh SQLite database
- Each scenario inserts records, runs `EntityExtractionProcess`, and asserts observable outcomes (node counts, link counts, edge presence, resolution decisions)
- The script prints a full graph dump at the end — nodes, edges, deduplication log, neighbor traversal — for human inspection
- Add `scripts/e2e.md` documenting prerequisites and how to run

## Capabilities

### New Capabilities

- `perirhinal-e2e`: manually-run end-to-end test script covering extraction, deduplication (exact/merge/llm-needed/distinct), edge creation, idempotency, and lock contention

### Modified Capabilities

_(none)_

## Impact

- New file: `scripts/e2e.ts`
- New file: `scripts/e2e.md`
- Runtime dependencies: `ANTHROPIC_API_KEY`, `OPENAI_API_KEY` environment variables
- No production code changes
