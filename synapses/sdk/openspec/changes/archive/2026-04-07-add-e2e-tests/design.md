## Context

`@neurome/sdk` is the public entry point to the neurome system. `startEngram()` spawns the cortex binary as a child process, waits for it to emit `"cortex ready"` on stderr, then connects `AxonClient` via Unix socket IPC. The `Engram` class proxies all operations over IPC and handles process teardown via `close()`.

This is a different integration tier from all other e2e tests: those exercise in-process library code. The SDK e2e is the only test that validates the binary/process/IPC runtime path.

The SDK must be **built** before the e2e runs (`tsup` produces `dist/bin/cortex.js` and `dist/bin/dendrite.js`). The e2e script triggers a build automatically via the npm script.

## Goals / Non-Goals

**Goals:**

- Validate `startEngram()` spawns cortex, waits for readiness signal, and connects IPC
- Validate `forkDatabase()` copies a source SQLite DB to a temp destination
- Validate `insertMemory()` + `recall()` round-trip through IPC boundary
- Validate `getStats()` returns a parseable stats object
- Validate `Engram.close()` terminates the cortex process cleanly within timeout

**Non-Goals:**

- Testing memory domain semantics (already covered by `@neurome/memory` e2e)
- Testing LLM extraction quality (already covered by `@neurome/amygdala` e2e)
- Testing `logInsight()` STM mechanics (already covered by `@neurome/memory` e2e)
- Testing `asMcpServer()` (pure config assembly, no process involved)
- Testing `fork()` beyond the forkDatabase path (that's axon→cortex plumbing)

## Decisions

**Build before run** — the `e2e` npm script runs `pnpm build && dotenv -e .env.e2e -- tsx scripts/e2e.ts`.
Reason: the cortex binary at `dist/bin/cortex.js` must exist. Unlike the other e2e scripts (which import library code transpiled at runtime by tsx), the SDK spawns the built binary as a separate process.

**Temp DB per run** — use `tmpdir()` for the DB path, clean up in a `finally` block.
Reason: `startEngram()` needs a real file path. Temp path avoids state leakage between runs.

**forkDatabase scenario uses a pre-seeded source DB** — insert one record into a source DB via `SqliteAdapter` directly, then call `startEngram({ source })` which triggers the fork path.
Reason: exercises the database copy code path that is otherwise never tested.

**Hard-assert mechanical facts, soft-warn on LLM judgment** — same pattern as amygdala/hippocampus e2e.

- Hard: `startEngram` returns without throwing, `getStats` is parseable, `close` exits cleanly
- Soft warn: whether `recall` returns the specific inserted record (IPC + LLM non-determinism)

**`Engram.close()` assertion** — after calling `close()`, assert the cortex child process has exited. Can be checked via the process's `exitCode` or by attempting a follow-up `getStats()` call which should reject.
Reason: validates the SIGTERM + force-kill path.

**No parallel scenario execution** — scenarios run sequentially within a single `Engram` instance.
Reason: avoids spawning multiple cortex processes; startup cost is the main bottleneck.

## Risks / Trade-offs

[Cortex startup time] → The 30s `waitForCortexReady` timeout means a slow CI machine could fail spuriously. Mitigated by not running in standard CI; explicit `pnpm run e2e` invocation only.

[Orphaned processes on assertion failure] → If a `throw` happens before `close()`, the cortex child process leaks. Mitigated by wrapping the main body in a `try/finally` that calls `engram.close()`.

[Build dependency] → The e2e requires a fresh `dist/`. If the dist is stale, the test runs against old binaries. Mitigated by building as part of the `e2e` npm script.

[IPC socket race] → The `connectWithRetry` in `startEngram` already handles this; the e2e doesn't need additional retry logic.
