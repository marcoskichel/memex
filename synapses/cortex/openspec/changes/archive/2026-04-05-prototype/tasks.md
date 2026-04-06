## 1. Workspace Setup

- [x] 1.1 Add `synapses/*` to `pnpm-workspace.yaml` packages list
- [x] 1.2 Create `packages/cortex/package.json` with `name: "@neurokit/cortex"`, `type: "module"`, `bin: { "cortex": "./dist/bin/cortex.js" }`, standard scripts (`build`, `dev`, `lint`, `lint:fix`, `test`, `typecheck`, `check`, `check:fix`)
- [x] 1.3 Create `packages/cortex/tsconfig.json` extending `@neurokit/typescript-config`
- [x] 1.4 Run `pnpm install` to link workspace deps

## 2. Memory Config Extension (`@neurokit/memory`)

- [x] 2.1 Add optional `stm?: InsightLog` field to `MemoryConfig` in `memory-types.ts`
- [x] 2.2 In `memory-factory.ts`, use `config.stm ?? new InsightLog()` instead of unconditional `new InsightLog()`
- [x] 2.3 Update `@neurokit/memory` unit tests to verify custom `stm` is threaded through

## 3. Cortex Bin Entry

- [x] 3.1 Create `packages/cortex/src/bin/cortex.ts`
- [x] 3.2 Implement `readConfig()`: read `MEMORY_DB_PATH`, `ANTHROPIC_API_KEY`, `MEMORY_SESSION_ID`; throw typed `ConfigError` if required vars missing
- [x] 3.3 Implement `main()`: call `readConfig`, construct `SqliteInsightLog`, construct `AnthropicAdapter`, call `createMemory`, register signal handlers, log ready state to stderr
- [x] 3.4 Implement `shutdownOnce()`: single-execution guard, call `memory.shutdown()`, `process.exit(0)`, start 30s force-exit timer
- [x] 3.5 Wire SIGTERM and SIGINT to `shutdownOnce()`

## 4. Tests

- [x] 4.1 Unit test: `readConfig()` throws `ConfigError` when `MEMORY_DB_PATH` is missing
- [x] 4.2 Unit test: `readConfig()` throws `ConfigError` when `ANTHROPIC_API_KEY` is missing
- [x] 4.3 Unit test: `readConfig()` returns correct config when all env vars set
- [x] 4.4 Unit test: `readConfig()` omits `sessionId` when `MEMORY_SESSION_ID` is unset
- [x] 4.5 Integration test: `main()` boots with a temp SQLite path and mocked `AnthropicAdapter`, verifies `memory.getStats()` returns without error
- [x] 4.6 Integration test: SIGTERM triggers shutdown and process exits 0

## 5. Build Verification

- [x] 5.1 Run `pnpm --filter @neurokit/cortex build` — no errors
- [x] 5.2 Run `pnpm --filter @neurokit/cortex check` — lint, typecheck, tests all pass
- [x] 5.3 Verify `node packages/cortex/dist/bin/cortex.js` exits 1 with error message when env vars missing
