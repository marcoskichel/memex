# fork-command

## Why

Cortex holds the open SQLite connection and is the only process that can safely execute `VACUUM INTO` on the active database. The `fork` IPC command must be handled server-side in cortex so the snapshot is consistent with the current in-memory state.

## What Changes

- Add `fork` handler in `synapses/cortex/src/ipc/handlers.ts`
- Handler runs `VACUUM INTO payload.outputPath` via the `better-sqlite3` connection
- Returns `{ forkPath: payload.outputPath }` on success; propagates error on failure (e.g. path not writable)
- Cortex binary accepts `--db <path>` flag to specify which database file to open (allows pointing at a fork, not just the default derived path)

## Impact

- App is responsible for the fork file's lifecycle — the output path must be writable and cleanup is the caller's responsibility
- No changes to existing handlers
