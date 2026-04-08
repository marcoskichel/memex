## 1. Package Setup

- [x] 1.1 Add `dotenv-cli` and `tsx` to `devDependencies` in `package.json`
- [x] 1.2 Add `"e2e": "dotenv -e .env.e2e -- tsx scripts/e2e.ts"` script to `package.json`
- [x] 1.3 Create `.env.e2e` with `ANTHROPIC_API_KEY` and `OPENAI_API_KEY` placeholders
- [x] 1.4 Verify `.env.e2e` is gitignored (check root `.gitignore`)

## 2. E2E Script Scaffold

- [x] 2.1 Create `scripts/e2e.ts` with env validation, DB setup (`SqliteAdapter` + `OpenAIEmbeddingAdapter` + `createLtmEngine`), and in-memory `InsightLog`
- [x] 2.2 Add helper utilities: `seedAccessCount()` (query with strengthen:true N times), `countLtmRecords()`, `insertRecord()`, `makeProcess()`, `assertOk()`

## 3. Scenarios

- [x] 3.1 Scenario 1 — baseline consolidation: insert 3 semantically similar records, seed access counts via `ltm.query(strengthen:true)`, run, hard-assert record count decreased
- [x] 3.2 Scenario 2 — temporal split: insert 3 Jan-2024 records + 3 Jul-2024 records (same topic), seed access counts, run, hard-assert 2 consolidations occurred
- [x] 3.3 Scenario 3 — minimum cluster size guard: insert 2 similar records only, run, hard-assert no consolidation and record count unchanged
- [x] 3.4 Scenario 4 — prune after consolidation: after S1, hard-assert total LTM record count is less than pre-run count
- [x] 3.5 Scenario 5 — STM context file cleanup: write real temp files, append `InsightLog` entries with `safeToDelete: true`, run, hard-assert files deleted from disk
- [x] 3.6 Scenario 6 — lock contention: acquire `hippocampus` lock on storage, run, hard-assert no consolidation occurred, release lock

## 4. Verification

- [x] 4.1 Run `pnpm run e2e` end-to-end and confirm all scenarios pass
- [x] 4.2 Run `pnpm run typecheck` — no TypeScript errors in `scripts/e2e.ts`
- [x] 4.3 Run `pnpm run lint` — no lint errors
