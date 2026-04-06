## 1. Dependencies

- [x] 1.1 Add `better-sqlite3` and `@types/better-sqlite3` to `packages/stm/package.json`

## 2. Schema

- [x] 2.1 Create `packages/stm/src/storage/sqlite-insight-schema.ts` with the `CREATE TABLE IF NOT EXISTS insights` DDL and a `rowToInsightEntry` mapper function

## 3. Implementation

- [x] 3.1 Create `packages/stm/src/storage/sqlite-insight-log.ts` implementing `append`, `readUnprocessed`, `markProcessed`, `clear`, and `allEntries` using `better-sqlite3` synchronous API
- [x] 3.2 Enable WAL mode (`PRAGMA journal_mode = WAL`) and `PRAGMA synchronous = NORMAL` in the `SqliteInsightLog` constructor (matching LTM adapter)
- [x] 3.3 Export `SqliteInsightLog` from `packages/stm/src/index.ts`

## 4. Tests

- [x] 4.1 Create `packages/stm/src/storage/sqlite-insight-log.test.ts` using a `:memory:` database
- [x] 4.2 Test `append` — returned entry has `id`, `timestamp`, `processed = false`; tags round-trip as array
- [x] 4.3 Test `readUnprocessed` — returns only unprocessed rows, ordered by timestamp ascending
- [x] 4.4 Test `markProcessed` — sets flag only on specified ids; no-op for unknown ids
- [x] 4.5 Test `clear` — deletes only processed rows; unprocessed rows survive
- [x] 4.6 Test `allEntries` — returns both processed and unprocessed rows
- [x] 4.7 Test `safeToDelete` round-trip — `true`, `false`, and `undefined` all deserialize correctly
- [x] 4.8 Test construction idempotency — constructing twice on same DB path does not throw and does not lose rows

## 5. Verification

- [x] 5.1 Run `pnpm test --filter @neurokit/stm` and confirm all tests pass
- [x] 5.2 Run `pnpm lint --filter @neurokit/stm` and fix any type or lint errors
