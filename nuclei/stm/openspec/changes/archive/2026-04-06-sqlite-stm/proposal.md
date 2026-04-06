## Why

The current `InsightLog` is in-memory only, which means hook scripts cannot append insights without IPC to a running daemon. Hook processes are short-lived and have no socket connection; they need a zero-dependency write path — open SQLite, INSERT, close — that works without any daemon being alive.

## What Changes

- Add `SqliteInsightLog` class that implements the same interface as `InsightLog` using `better-sqlite3`
- Add `insights` table DDL to the STM package (co-located with or alongside the LTM SQLite file)
- Export `SqliteInsightLog` from `@neurokit/stm` alongside the existing in-memory `InsightLog`
- The in-memory `InsightLog` is NOT removed (daemon and tests can continue using it)

## Capabilities

### New Capabilities

- `sqlite-insight-log`: A SQLite-backed implementation of the insight log that persists `InsightEntry` rows to an `insights` table, supports direct INSERT from hook scripts without a running daemon, and exposes the same `append / readUnprocessed / markProcessed / clear / allEntries` API as the in-memory log

### Modified Capabilities

_(none — no existing spec-level requirements are changing)_

## Impact

- `packages/stm/src/` — new `sqlite-insight-log.ts` source file
- `packages/stm/src/index.ts` — export `SqliteInsightLog`
- Peer dependency on `better-sqlite3` (already used by `@neurokit/ltm`; add to `stm` `package.json`)
- No breaking changes; existing `InsightLog` and `InsightEntry` types are unchanged
- Downstream: the cortex daemon change will swap the in-memory log for `SqliteInsightLog`
