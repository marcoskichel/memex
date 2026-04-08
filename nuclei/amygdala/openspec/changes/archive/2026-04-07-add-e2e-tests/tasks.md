## 1. Package Setup

- [x] 1.1 Add `dotenv-cli` and `tsx` to `devDependencies` in `package.json`
- [x] 1.2 Add `"e2e": "dotenv -e .env.e2e -- tsx scripts/e2e.ts"` script to `package.json`
- [x] 1.3 Create `.env.e2e` with `ANTHROPIC_API_KEY` and `OPENAI_API_KEY` placeholders
- [x] 1.4 Verify `.env.e2e` is gitignored (check root `.gitignore`)

## 2. E2E Script Scaffold

- [x] 2.1 Create `scripts/e2e.ts` with env validation, DB setup (`SqliteAdapter` + `OpenAIEmbeddingAdapter` + `createLtmEngine`), and `InsightLog`
- [x] 2.2 Add helper utilities: `writeTempContextFile()`, `countLtmRecords()`, `assertOk()`, `makeProcess()`

## 3. Scenarios

- [x] 3.1 Scenario 1 — high-importance insert: append observation with real context file, run, hard-assert LTM record exists
- [x] 3.2 Scenario 2 — noise skip: append trivial observation, run, hard-assert LTM record count unchanged
- [x] 3.3 Scenario 3 — follow-up relate: insert first memory via cycle 1, append related follow-up, run cycle 2, hard-assert second LTM record, soft-warn on edge type
- [x] 3.4 Scenario 4 — low-cost mode: set `lowCostModeThreshold: 0`, append observation (no context file needed), run, hard-assert record inserted
- [x] 3.5 Scenario 5 — lock contention: acquire `amygdala` lock on `storage`, run, assert no new LTM records, release lock

## 4. Verification

- [x] 4.1 Run `pnpm run e2e` end-to-end and confirm all scenarios pass
- [x] 4.2 Run `pnpm run typecheck` — no TypeScript errors in `scripts/e2e.ts`
- [x] 4.3 Run `pnpm run lint` — no lint errors
