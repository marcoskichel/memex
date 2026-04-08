## Context

`@neurome/memory` wraps `createMemory()` which starts amygdala and hippocampus background processes and exposes a unified `Memory` API. The key user-facing flows — `importText()` (LLM extraction → bulk insert), `insertMemory()`, `recall()` (LTM query), and `logInsight()` (STM append → amygdala processing) — are exercised by clients through this API, not directly through the underlying engines.

All three existing upper-tier e2e tests (amygdala, hippocampus, perirhinal) exercise those engines directly. None exercise the `MemoryImpl` orchestration layer, `importText` flow, or the event wiring between components.

`@neurome/perirhinal` established the pattern: standalone `scripts/e2e.ts` + temp SQLite DB + `pnpm run e2e`.

## Goals / Non-Goals

**Goals:**

- Exercise `createMemory()` wiring: all deps connected, amygdala + hippocampus started
- Cover `importText()`: LLM extracts facts → `ltm.bulkInsert()` → `recall()` finds them
- Cover `insertMemory()` → `recall()` round-trip
- Cover `logInsight()` → `getContext()` verifying STM is populated
- Cover `stats()` and `shutdown()` mechanics
- Validate `PendingConsolidationStore` TTL behavior (expired pending consolidations are dropped)

**Non-Goals:**

- Replace amygdala/hippocampus individual e2e tests
- Test timer-based cycling (amygdala/hippocampus background loops)
- Measure LLM accuracy or prompt quality
- Test `fork()` or `pruneContextFiles()`

## Decisions

**Script vs vitest e2e tests** — raw `scripts/e2e.ts`, same as perirhinal.
Reason: explicit `pnpm run e2e` invocation is intentional; avoids accidental CI spend.

**Amygdala/hippocampus cycles disabled** — set `amygdalaCadenceMs` and `hippocampusScheduleMs` to very large values (e.g., `999_999_999`) so background processes don't interfere with assertions. The e2e validates the orchestration wiring, not the cycle behavior.

**Assertion style** — mixed:

- Hard `throw` on mechanical facts: records inserted, `recall()` returns results, `stats()` counts are non-zero, `shutdown()` succeeds
- `console.warn` on LLM judgment calls: which specific facts `importText` extracts (count and content can vary slightly)

**importText scenario** — provide a multi-sentence paragraph. Assert that at least N records were bulk-inserted into LTM (hard assert on count >= 1). Then `recall()` with a semantically related query and assert results are non-empty (hard assert). Do not assert specific text content (LLM non-determinism).

**logInsight scenario** — call `logInsight()`, then `getContext()` and assert the context file exists and is non-empty.

**PendingConsolidationStore TTL** — set `pendingConsolidationTtlMs: 0` in config, submit a pending consolidation, assert it is dropped on the next commit cycle. This exercises the TTL path without real hippocampus cycling.

## Risks / Trade-offs

[LLM non-determinism] → `importText` extraction count may vary. Mitigated by asserting `count >= 1` (hard) and `console.warn` on exact count or content.

[API cost] → Each run makes ~5-10 LLM calls + embeddings. Mitigated by not running in standard CI.

[Background process interference] → Amygdala/hippocampus timers must not fire during assertions. Mitigated by setting cadence/schedule to very large values.

[Shutdown timing] → `shutdown()` waits for hippocampus cycle. With large schedule values, the wait should be near-zero. If flaky, add a `hippocampusCycleWaitedMs` assertion with a generous upper bound.
