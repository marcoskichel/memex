# tui-memory-management

## Why

The TUI is read-only. Errors in components are silently swallowed. There is no way to create memories manually, import from files, browse recent records, or recover a broken connection without restarting. This change makes the TUI a first-class memory management interface.

## What Changes

- **memex-tui**: toast bar, command palette, memory write form, MD import with preview, tabbed StatsPane with recent memories browser
- **cortex**: three new IPC handlers — `insertMemory`, `importText`, `getRecent`
- **memory**: three new methods on `Memory` interface — `insertMemory`, `importText`, `getRecent`

## Non-goals

- Session ID switching in-app (deferred)
- Memory editing or deletion
- Import from non-markdown formats

## Linked Changes

See `links.yaml`.
