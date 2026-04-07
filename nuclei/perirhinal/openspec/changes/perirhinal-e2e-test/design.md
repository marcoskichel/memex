## Context

The perirhinal extraction pipeline has unit tests (pure logic, mocked LLM) and integration tests (InMemoryAdapter, mocked LLM). Neither exercises the full stack: real LLM extraction, real embeddings, SQLite storage, and the deduplication resolution paths firing on actual vector geometry. The end-to-end test fills this gap.

## Goals / Non-Goals

**Goals:**

- Run the full extraction pipeline against real external services (Anthropic + OpenAI)
- Exercise all four resolution paths: exact, merge, llm-needed, distinct
- Produce human-readable output that confirms the graph structure is correct
- Be runnable manually with a single command: `pnpm tsx scripts/e2e.ts`

**Non-Goals:**

- Running in CI (requires real API keys, costs money, is non-deterministic)
- Testing error handling / network failure paths
- Load or performance testing

## Decisions

**`tsx` script, not a Vitest test.**
The script is a standalone executable, not part of the test suite. Vitest test files are discovered automatically and would run in CI. A script in `scripts/` is opt-in.

**Fresh SQLite file per run, preserved after.**
`/tmp/perirhinal-e2e-{timestamp}.db` — deleted at the start if it exists, preserved at the end so the tester can inspect with any SQLite browser. Path printed at the end of the run.

**`embedEntity` = `openai.embed(entity.name + " (" + entity.type + ")")`.**
Embedding the name alone loses type context ("Atlas" alone is ambiguous — a map, a titan, a project). Including the type in the embedded string biases the geometry toward the semantic role. This is the first codification of this convention.

**8 scenarios, sequential, shared SQLite state.**
Each scenario builds on the previous graph state. Entities inserted in scenario 1 are the deduplication targets in scenarios 2–4. This mirrors production usage and tests the cumulative graph correctly.

**Scenarios:**

| #   | Record                                                   | Focus                                                |
| --- | -------------------------------------------------------- | ---------------------------------------------------- |
| 1   | Maya + Jordan meet, Atlas is the priority                | Baseline insertion, edge creation                    |
| 2   | Jordan shares Q2 roadmap, Atlas mentioned                | Exact dedup (both entities exist)                    |
| 3   | Sasha builds Atlas frontend in TypeScript                | Partial exact dedup (Atlas exists, Sasha/TS new)     |
| 4   | Lena debates PostgreSQL vs Redis for Cortex              | Multi-entity record, multi-edge insertion            |
| 5   | Maya finishes Postgres setup for Atlas                   | **Probe**: "Postgres" vs "PostgreSQL" similarity     |
| 6   | Maya explores RAG for Atlas; later record uses full name | **Probe**: "RAG" vs "retrieval-augmented generation" |
| 7   | Jordan + Lena align on Cortex + TypeScript               | Zero new nodes, edges-only run                       |
| 8   | Dr. Isabel Reyes joins board call                        | Isolated new node, no edges                          |

**Print resolution decisions explicitly.**
For each entity in each run, print: `name → resolution(exact/merge/llm-needed/distinct) [cosine=X.XX]`. The tester can verify the dedup probes fired on the right path.

**Hard assertions + soft observations.**
Hard: node counts, link counts, `isOk()` on `run()` results, `LOCK_FAILED` on contention.
Soft: dedup decisions, edge relationship types (LLM-generated, non-deterministic).

## Risks / Trade-offs

[LLM non-determinism] → The LLM may extract slightly different entity names or relationship types across runs. Hard assertions are limited to structural properties (counts, presence/absence). The tester reads the dedup log and graph dump for semantic correctness.

[Embedding model geometry] → The cosine thresholds (0.85, 0.70) may not behave as expected for all entity pairs with `text-embedding-3-small`. The probes in scenarios 5 and 6 may fire `distinct` rather than `merge` or `llm-needed`. The script prints the cosine so the tester can observe and inform a threshold calibration decision.

[Cost] → 8 scenarios × ~2 LLM calls + ~3 embedding calls per record ≈ 24 LLM calls + 24 embedding calls. Negligible cost on Haiku + text-embedding-3-small.
