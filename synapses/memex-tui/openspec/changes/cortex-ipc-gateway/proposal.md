## Why

The memory system is a black box at runtime — there is no way to observe what cortex is doing, watch insights being scored, or run ad-hoc recall queries against a live session. A TUI built on Ink (same library as Claude Code) provides real-time observability and an interactive query interface without requiring a separate web server.

## What Changes

- New `synapses/memex-tui` package — an Ink-based TUI that connects to the cortex socket
- Three-pane layout: live event feed (left), stats panel (right), query REPL (bottom)
- Event feed shows all `MemoryEvents` as they arrive — amygdala cycles, insight scores, hippocampus consolidations, LTM decay
- Stats panel polls `getStats` on a 2-second interval and renders LTM/STM/amygdala/hippocampus/disk stats
- Query REPL accepts natural-language queries, sends `recall` to cortex, renders ranked results with score, type, tags, and date; `enter` on a result sends `recallFull` to show the full record
- Works with or without an active agent session — any session that has a socket open is queryable

## Capabilities

### New Capabilities

- `tui-socket-client`: Persistent socket client with auto-reconnect, event subscription, and typed request/response
- `tui-layout`: Three-pane Ink layout with keyboard navigation between panes
- `tui-query-repl`: Interactive recall interface — input, result list, full-record detail view

### Modified Capabilities

## Impact

- `synapses/memex-tui/` — new package; depends on `ink`, `react`, `@memex/memory` (types only)
- `pnpm-workspace.yaml` — `synapses/memex-tui` already listed under `synapses/*`
- `openspec/workspace.yaml` — `memex-tui` scope added
