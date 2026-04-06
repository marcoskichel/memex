## Context

`@neurokit/stm` currently exports only `InsightLog`, an in-memory store. The planned daemon (cortex) will own a long-running process and can hold this in memory fine. However, Claude Code hook scripts are short-lived child processes with no socket or IPC channel to the daemon. They need to write insights by opening the SQLite file directly, inserting a row, and exiting — with zero daemon dependency.

`@neurokit/ltm` already uses `better-sqlite3` with WAL mode, so the pattern is established. The STM package just needs the same dependency and a thin wrapper that maps `InsightEntry` to an `insights` table.

## Goals / Non-Goals

**Goals:**

- Implement `SqliteInsightLog` against the same interface surface as `InsightLog`
- Define and migrate the `insights` table inside the same SQLite file used by LTM
- Allow hook scripts to INSERT rows without any running daemon
- Export `SqliteInsightLog` from the package public API
- Cover the implementation with unit tests using a `:memory:` database

**Non-Goals:**

- Replacing or removing the in-memory `InsightLog`
- Building the cortex daemon (separate change)
- Encryption or access control on the SQLite file
- Any form of connection pooling or multi-writer coordination beyond WAL mode

## Decisions

### D1: Single file for LTM + STM

The `insights` table lives in the same SQLite file as LTM records. The `SqliteInsightLog` constructor accepts a `dbPath` string — same as `SqliteAdapter` — so the caller controls colocation.

**Alternatives considered:**

- Separate `stm.db` file: cleaner isolation but doubles the open-file count and complicates path management for hook scripts that only know the single neurokit DB path.

### D2: Schema ownership inside `@neurokit/stm`

`SqliteInsightLog` runs `CREATE TABLE IF NOT EXISTS insights (...)` in its constructor (same pattern as `SqliteAdapter` running `SCHEMA`). No external migration tool required.

**Alternatives considered:**

- Delegating DDL to LTM's migration runner: introduces a cross-package dependency where none should exist.

### D3: Synchronous API (better-sqlite3)

All methods are synchronous, matching the existing `InsightLog` interface. This is also the right choice for hook scripts that must complete quickly and cannot await promises.

### D4: Tags serialized as JSON text

`InsightEntry.tags` is `string[]`. Stored as a JSON-encoded text column — same pattern used by `metadata` in LTM records. No array column type needed.

### D5: Timestamps stored as integer milliseconds

`Date` objects are persisted as `INTEGER` (Unix ms), same as LTM. On read, converted back to `Date` via `new Date(row.timestamp)`.

### D6: `clear()` semantics unchanged

Mirrors the in-memory `InsightLog.clear()`: deletes only rows where `processed = 1`. Unprocessed rows are never silently dropped.

## Risks / Trade-offs

- **Concurrent writers** → WAL mode handles multiple readers and one writer safely. Hook scripts write single rows; the daemon reads. No explicit locking needed at the application layer.
- **Schema drift between STM and LTM** → Both packages own their own DDL. If the DB file path is shared, both run their own `CREATE TABLE IF NOT EXISTS` independently — no conflict.
- **`InsightEntry.safeToDelete` is optional** → Stored as `INTEGER` nullable; reads back as `boolean | undefined` correctly.

## Migration Plan

No data migration required. `CREATE TABLE IF NOT EXISTS` is idempotent. Existing DB files without the `insights` table get it automatically on first `SqliteInsightLog` construction.

Rollback: drop the `insights` table. No other tables are affected.

## Open Questions

_(none — all decisions made)_
