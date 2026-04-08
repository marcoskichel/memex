## 1. Project Setup

- [x] 1.1 Add `dotenv-cli` and `tsx` to `devDependencies` in `package.json`
- [x] 1.2 Add `"e2e": "dotenv -e .env.e2e -- tsx scripts/e2e.ts"` script to `package.json`
- [x] 1.3 Add `.env.e2e` to `.gitignore` (if not already present)
- [x] 1.4 Create `scripts/` directory

## 2. E2E Script — Infrastructure

- [x] 2.1 Create `scripts/e2e.ts` with env validation (`ANTHROPIC_API_KEY`, `OPENAI_API_KEY`)
- [x] 2.2 Set up temp SQLite DB path via `tmpdir()` with cleanup on exit
- [x] 2.3 Instantiate `AnthropicAdapter`, `OpenAIEmbeddingAdapter`, and call `createMemory()` with large cadence/schedule values to suppress background cycling
- [x] 2.4 Define `assertOk` helper and wrap `main()` with fatal error handler

## 3. E2E Script — Scenarios

- [x] 3.1 Scenario: `createMemory()` wiring — assert `Memory` instance is operational and `stats()` returns numeric counts
- [x] 3.2 Scenario: `importText()` with multi-sentence paragraph — assert `inserted >= 1` (hard) and log actual count
- [x] 3.3 Scenario: `recall()` after `importText()` — assert results are non-empty (hard); warn if specific expected facts are missing
- [x] 3.4 Scenario: `importText()` with empty/whitespace string — assert `inserted === 0`
- [x] 3.5 Scenario: `insertMemory()` + `recall()` round-trip — insert a specific string, assert it appears in recall results
- [x] 3.6 Scenario: `logInsight()` — call with summary + context file path, assert file exists on disk and is non-empty
- [x] 3.7 Scenario: `stats()` — assert `ltm.totalRecords > 0` after insertions
- [x] 3.8 Scenario: `shutdown()` — assert `ShutdownReport.engramId` matches instance, no error thrown

## 4. Verification

- [x] 4.1 Run `pnpm run e2e` end-to-end and confirm all scenarios pass
- [x] 4.2 Confirm background amygdala/hippocampus cycles do not fire during the script run
- [x] 4.3 Confirm script exits with code 0 on success and non-zero on any assertion failure
- [x] 4.4 Confirm temp DB and context files are cleaned up after the run
