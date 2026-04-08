## 1. Project Setup

- [x] 1.1 Add `dotenv-cli` and `tsx` to `devDependencies` in `package.json`
- [x] 1.2 Add `"e2e": "dotenv -e .env.e2e -- tsx scripts/e2e.ts"` script to `package.json`
- [x] 1.3 Add `.env.e2e` to `.gitignore` (if not already present)
- [x] 1.4 Create `scripts/` directory

## 2. E2E Script — Infrastructure

- [x] 2.1 Create `scripts/e2e.ts` with env validation (`OPENAI_API_KEY`)
- [x] 2.2 Set up temp SQLite DB via `tmpdir()` with cleanup on exit
- [x] 2.3 Instantiate `SqliteAdapter`, `OpenAIEmbeddingAdapter`, and `LtmEngine`
- [x] 2.4 Define `assertOk` and `assertThrows` helper functions

## 3. E2E Script — Scenarios

- [x] 3.1 Scenario: insert + semantic query round-trip (assert result contains inserted record)
- [x] 3.2 Scenario: insert two unrelated records + assert query specificity (unrelated record not in top results)
- [x] 3.3 Scenario: `relate()` two records + assert edge ID is positive and both records retrievable
- [x] 3.4 Scenario: `findEntityPath()` — insert records with entity metadata, create edges, assert path A→C→B
- [x] 3.5 Scenario: `findEntityPath()` — assert empty path for unconnected entities
- [x] 3.6 Scenario: `consolidate()` — insert two episodic records, consolidate, assert sources tombstoned + semantic record queryable
- [x] 3.7 Scenario: `prune()` — insert low-importance/old record, prune, assert pruned >= 1 + record not in query results
- [x] 3.8 Scenario: decay events — attach `EventTarget` listener, query with `strengthen: true` on low-stability record, assert event fires
- [x] 3.9 Scenario: `stats()` — assert counts consistent with insertions and pruning

## 4. Verification

- [x] 4.1 Run `pnpm run e2e` end-to-end and confirm all scenarios pass
- [x] 4.2 Confirm no embedding dimension mismatches in SQLite
- [x] 4.3 Confirm script exits with code 0 on success and non-zero on any assertion failure
