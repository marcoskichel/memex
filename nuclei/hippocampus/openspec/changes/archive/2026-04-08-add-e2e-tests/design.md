## Context

`@neurome/hippocampus` consolidates clusters of similar episodic LTM records into single semantic summaries. All existing tests mock `LtmEngine` and `LLMAdapter`. The integration surface — embedding-based clustering, LLM summarization schema, `ltm.consolidate` wiring, temporal splitting, prune behavior — has no real-world validation.

`@neurome/perirhinal` and `@neurome/amygdala` established the pattern: a standalone `scripts/e2e.ts` script against real APIs with a temp SQLite DB and narrative scenarios.

## Goals / Non-Goals

**Goals:**

- Exercise the full `HippocampusProcess.run()` pipeline against real Anthropic LLM and OpenAI embeddings
- Cover: baseline consolidation, temporal splitting, minimum cluster size guard, prune, STM-based context file cleanup, lock contention
- Match perirhinal/amygdala script structure (hard assert on mechanical guarantees, soft warn on LLM judgment)

**Non-Goals:**

- Replace unit tests or add new unit coverage
- Test `HippocampusProcess.start()` / timer-based cycling
- Test `contextDir`-based file cleanup (only STM-based path)
- Trigger false-memory-risk suppression (requires contradictory facts; left to unit tests)

## Decisions

**Script vs vitest** — raw `scripts/e2e.ts`, consistent with perirhinal and amygdala.

**In-memory InsightLog** — for the context file cleanup scenario (S5). SqliteInsightLog adds a second DB and teardown complexity for no coverage gain.

**Access count seeding via `ltm.query` with `strengthen: true`** — after inserting records, query them twice with `strengthen: true` to reach `minAccessCount: 2`. This mirrors production behavior (records worth consolidating are those already retrieved) rather than bypassing via `minAccessCount: 0`.

**Temporal split scenario** — insert records with explicitly backdated `createdAt` values spanning two clusters (Jan and Jul), separated by > 30 days. Since we control timestamps at insert time, this scenario is fully deterministic — no LLM judgment involved.

**Assertion style** — mirrors perirhinal/amygdala:

- Hard `throw` on mechanical facts: consolidation happened, record count changed, files deleted, lock deferred cycle
- `console.warn` on LLM judgment: exact summary content, preserved facts list

## Risks / Trade-offs

[Clustering requires cosine similarity >= 0.85] → Mitigation: use highly semantically similar observations for the same subject (e.g., multiple "Alice prefers TypeScript" variants). If similarity falls short, the scenario will warn and skip consolidation without throwing.

[accessCount seeding via strengthen:true requires LtmEngine.query to increment counts] → Mitigation: verify count pre/post query in the script; warn if counts don't reach threshold.

[API cost] → ~6-8 LLM calls + embeddings per run. Explicit `pnpm run e2e` only, not in standard CI.
