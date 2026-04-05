## Context

`@neurokit/memory` already exports `createMemory(config: MemoryConfig)` which boots `AmygdalaProcess` and `HippocampusProcess` and returns a `Memory` instance. The daemon is a thin shell around this factory: read env, call the factory, handle signals, block forever.

The `sqlite-stm` change (prerequisite) adds `SqliteInsightLog` to `@neurokit/stm`. The daemon passes a `SqliteInsightLog` instance pointing at `MEMORY_DB_PATH` as the STM, so hook scripts writing to the same file are immediately visible to the amygdala without any IPC.

## Goals / Non-Goals

**Goals:**

- Single executable that boots the full memory stack and keeps it alive
- Clean shutdown via SIGTERM/SIGINT: drain amygdala, wait for hippocampus cycle, close SQLite
- Config from env vars only — no config file, no CLI flags
- Runnable as `npx @neurokit/cortex` or globally installed as `cortex`
- Cover startup and shutdown paths with integration tests

**Non-Goals:**

- A library API (no public exports beyond the bin entry)
- HTTP/socket server or RPC interface
- Multi-session or multi-DB support
- Log forwarding or structured logging beyond stderr

## Decisions

### D1: No public exports — bin only

`packages/cortex` has no `index.ts`. The `exports` field in `package.json` is absent. Only the `bin` field is set. Importing `@neurokit/cortex` as a library is not supported.

**Alternatives considered:**

- Exporting `startDaemon()`: creates a false library surface; callers can just run `createMemory()` directly. No caller needs to import this package.

### D2: `SqliteInsightLog` as STM backend

`createMemory()` currently uses `InsightLog` (in-memory). The daemon passes `SqliteInsightLog` so insights written by hook scripts survive in the shared DB file.

**Note:** `createMemory()` currently constructs `InsightLog` internally. Passing a custom STM instance requires either: (a) adding a `stm` option to `MemoryConfig`, or (b) exporting a lower-level factory. Option (a) is the minimal change to `@neurokit/memory` required by this change — add `stm?: InsightLog` to `MemoryConfig` and use it when provided.

### D3: Env var validation at startup — fail fast

Missing `MEMORY_DB_PATH` or `ANTHROPIC_API_KEY` → log to stderr, `process.exit(1)`. No fallbacks.

### D4: Signal handling — graceful shutdown only once

`SIGTERM` and `SIGINT` both call `memory.shutdown()`. A second signal force-exits. Shutdown timeout: 30 seconds max before force exit.

### D5: `AnthropicAdapter` from `@neurokit/llm`

The LLM adapter is constructed from `ANTHROPIC_API_KEY` using the existing `AnthropicAdapter` (or equivalent) in `@neurokit/llm`. No new LLM integration code needed.

## File Layout

```
packages/cortex/
  package.json          # name: @neurokit/cortex, bin: { cortex: ./dist/bin/cortex.js }
  tsconfig.json
  src/
    bin/
      cortex.ts         # entry point: parse env, call createMemory, handle signals
    __tests__/
      cortex.test.ts    # startup config validation, shutdown integration test
```

## Function Structure

### `cortex.ts` (bin entry)

```
readConfig()
  - read MEMORY_DB_PATH, ANTHROPIC_API_KEY, MEMORY_SESSION_ID from process.env
  - throw ConfigError if MEMORY_DB_PATH or ANTHROPIC_API_KEY missing

main()
  - call readConfig() → exit(1) on ConfigError, log to stderr
  - construct SqliteInsightLog(dbPath)
  - construct AnthropicAdapter(apiKey)
  - call createMemory({ storagePath: dbPath, llmAdapter, stm, sessionId? })
  - register SIGTERM / SIGINT → shutdownOnce()
  - log "cortex ready" to stderr

shutdownOnce()
  - guard: only run once
  - call memory.shutdown()
  - clearTimeout(forceExitTimer)
  - process.exit(0)
  - start 30s forceExit timer in parallel
```

## Risks / Trade-offs

- **`MemoryConfig.stm` addition** — minor change to `@neurokit/memory`. Low risk; additive only. Must be done as part of this change.
- **Long startup time** — TransformersJS model download on first run. No mitigation needed; subsequent starts use the cached model.
- **Hook scripts start before daemon** — hook scripts write to SQLite directly; rows persist. Amygdala picks them up on next cadence tick when daemon starts. No data loss.

## Open Questions

_(none — all decisions made)_
