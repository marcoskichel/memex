## Context

`@neurome/amygdala` scores and classifies short-term memory observations into long-term memory. All existing tests mock `LtmEngine`, `InsightLog`, and `LLMAdapter`. The integration surface — prompt content, LLM schema parsing, `LtmEngine` wiring, embedding round-trips — has no real-world validation.

`@neurome/perirhinal` established the pattern: a standalone `scripts/e2e.ts` script that runs against real APIs with a temp SQLite DB, driven by narrative scenarios.

## Goals / Non-Goals

**Goals:**

- Exercise the full `AmygdalaProcess.run()` pipeline against real Anthropic LLM and OpenAI embeddings
- Cover: insert, skip, relate, tier promotion, low-cost mode, lock contention
- Match perirhinal's script structure and assertion style (hard on mechanical guarantees, soft warn on LLM judgment)

**Non-Goals:**

- Replace unit tests or add new unit coverage
- Test `AmygdalaProcess.start()` / timer-based cycling
- Measure LLM accuracy or prompt quality

## Decisions

**Script vs vitest e2e tests** — raw `scripts/e2e.ts` script, same as perirhinal.
Reason: e2e scenarios make real API calls (seconds each). Mixing into the vitest runner risks accidental CI spend and slow feedback loops. An explicit `pnpm run e2e` command is intentional and cheap to skip.

**In-memory InsightLog vs SqliteInsightLog** — `InsightLog` (in-memory).
Reason: STM persistence is not what we're testing. SqliteInsightLog adds a second DB file and more teardown complexity for no coverage gain at the e2e level.

**Context files** — real temp files written per-scenario with narrative content.
Reason: exercises `buildPromptWithContext` (the default non-low-cost path). One dedicated scenario forces `lowCostModeThreshold: 0` to cover `buildPrompt` as well.

**Assertion style** — mirrors perirhinal:

- Hard `throw` on mechanical facts: record inserted, LTM has records, lock deferred cycle
- `console.warn` on LLM judgment calls: whether action is `relate` vs `insert`, exact tier

**Relate scenario setup** — insert a first memory via an explicit `AmygdalaProcess.run()` cycle, then append a clearly related follow-up observation. `LtmEngine.query` will surface the first memory in the prompt context, nudging the LLM toward `relate`. The test hard-asserts that a second LTM record was written; it soft-warns if the edge type is unexpected.

**Real LtmEngine setup** — `SqliteAdapter` + `OpenAIEmbeddingAdapter` + `createLtmEngine`, same as perirhinal. Temp DB path via `tmpdir()`.

## Risks / Trade-offs

[LLM non-determinism] → Skip and relate scenarios may occasionally produce unexpected actions. Mitigated by using extremely unambiguous observations ("User pressed spacebar" for skip) and `console.warn` instead of throw.

[API cost] → Each run makes ~6-8 LLM calls + embeddings. Mitigated by not running in standard CI; explicit `pnpm run e2e` invocation only.

[Embedding dimension mismatch] → LtmEngine uses `text-embedding-3-small` (1536 dims). Hardcoded in `SqliteAdapter` schema. Must match `OpenAIEmbeddingAdapter` default. Not a risk unless the model changes.
