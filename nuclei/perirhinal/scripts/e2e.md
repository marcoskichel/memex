# Perirhinal E2E Test

Manually-run script that exercises the full extraction pipeline against real Anthropic and OpenAI services backed by a fresh SQLite database.

## Prerequisites

- Node.js 22+, pnpm
- `ANTHROPIC_API_KEY` — used for entity extraction and deduplication LLM calls (Haiku 4.5)
- `OPENAI_API_KEY` — used for entity embeddings (text-embedding-3-small, 1536 dimensions)

## How to run

```bash
cd nuclei/perirhinal
ANTHROPIC_API_KEY=... OPENAI_API_KEY=... pnpm e2e
```

The script prints the DB path at the start. The database is preserved after the run so you can inspect it with any SQLite browser (e.g. `sqlite3`, DB Browser for SQLite).

## `embedEntity` convention

Entities are embedded as `"{name} ({type})"` — e.g. `"PostgreSQL (tool)"`, `"Maya Chen (person)"`. Including the type in the embedded string biases the geometry toward the semantic role of the entity and improves deduplication accuracy.

## Scenarios

| #   | Record                                    | Focus                                                     |
| --- | ----------------------------------------- | --------------------------------------------------------- |
| 1   | Maya Chen + Jordan Park + Atlas           | Baseline: 3 new nodes, record linked                      |
| 2   | Jordan Park + Atlas (again)               | Exact dedup: 0 new nodes                                  |
| 3   | Sasha Novak + Atlas + TypeScript          | Partial dedup: 2 new nodes (Atlas reused)                 |
| 4   | Lena Muller + PostgreSQL + Redis + Cortex | Multi-entity: 4 new nodes + edges                         |
| 5   | Postgres (tool)                           | Dedup probe: print cosine vs PostgreSQL, print resolution |
| 6a  | RAG (concept)                             | Fresh insert                                              |
| 6b  | retrieval-augmented generation (concept)  | Dedup probe: print cosine vs RAG, print resolution        |
| 7   | Jordan + Lena + Cortex + TypeScript       | Edges-only: 0 new nodes, new edges                        |
| 8   | Dr. Isabel Reyes                          | Isolated node: 1 new node, no neighbors                   |

## Interpreting output

**Hard assertions** (throw on failure):

- Node counts for scenarios 1, 4, 8
- Every record is linked after its scenario
- Lock contention returns `LOCK_FAILED`
- Final `getUnlinkedRecordIds()` is empty
- Dr. Isabel Reyes has no depth-2 neighbors

**Soft observations** (printed, not asserted):

- Scenarios 2, 3, 7: node count warnings if LLM extracts different names
- Scenarios 5, 6b: cosine similarity between variant names + resolution decision
- Edge relationship types (LLM-generated, non-deterministic)

**Dedup probe interpretation** (scenarios 5 and 6b):

- cosine ≥ 0.99 → likely exact match (same embedding geometry → reuse)
- cosine 0.85–0.99 → merge (auto-reuse without LLM)
- cosine 0.70–0.85 → llm-needed (LLM decides)
- cosine < 0.70 → distinct (inserted as new node)

If scenario 5 or 6b fires `distinct`, consider lowering the merge/ambiguous thresholds in `entity-resolver.ts`.
