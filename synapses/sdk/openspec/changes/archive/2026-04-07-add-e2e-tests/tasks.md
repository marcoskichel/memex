## 1. Project Setup

- [x] 1.1 Add `dotenv-cli` to `devDependencies` in `package.json`
- [x] 1.2 Add `"e2e": "pnpm build && dotenv -e .env.e2e -- tsx scripts/e2e.ts"` script to `package.json`
- [x] 1.3 Add `.env.e2e` to `.gitignore`
- [x] 1.4 Create `scripts/` directory

## 2. E2E Script — Infrastructure

- [x] 2.1 Create `scripts/e2e.ts` with env validation (`ANTHROPIC_API_KEY`, `OPENAI_API_KEY`)
- [x] 2.2 Set up temp DB path via `tmpdir()` and wrap `main()` in `try/finally` that calls `engram.close()`
- [x] 2.3 Seed a source SQLite DB for the forkDatabase scenario using `SqliteAdapter` directly

## 3. E2E Script — Scenarios

- [x] 3.1 Scenario: `startEngram()` — assert resolves, `engramId` matches config, no throw
- [x] 3.2 Scenario: `startEngram({ source })` — assert destination DB exists after startup, `getStats().ltm.totalRecords >= 1`
- [x] 3.3 Scenario: `insertMemory()` + `recall()` — insert a fact, assert recall returns at least one result
- [x] 3.4 Scenario: `getStats()` — assert result is non-null with numeric record count > 0
- [x] 3.5 Scenario: `close()` — assert resolves within 15s; assert follow-up IPC call throws

## 4. Verification

- [x] 4.1 Run `pnpm run e2e` and confirm all scenarios pass
- [x] 4.2 Confirm cortex process does not leak on assertion failure (try/finally cleanup)
- [x] 4.3 Confirm script exits with code 0 on success and non-zero on any assertion failure
