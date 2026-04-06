## Why

The TUI is read-only. Errors in components are silently swallowed. There is no way to create memories manually, import from files, browse recent records, or recover a broken connection without restarting.

## What Changes

- Toast bar for component-level error/warning display (auto-dismiss 4s)
- Command palette (`:` activated) with `:add`, `:import <path>`, `:reset` commands
- Memory write form with all LTM fields — content, tier, category, importance, tags, episodeSummary
- MD import: `---` delimited structured blocks OR free-text LLM ingestion; preview + confirmation
- StatsPane becomes tabbed: `[s]` stats view, `[m]` scrollable recent memories list

## Capabilities

### New Capabilities

- `tui-toast-bar`: ephemeral error/warning queue, auto-dismiss 4s, queued FIFO
- `tui-command-palette`: `:` activated globally; static autocomplete; commands: `:add`, `:import <path>`, `:reset`
- `tui-memory-form`: multi-field LTM write form (content, tier, category, importance, tags, episodeSummary); keyboard-only navigation
- `tui-md-import`: parse `---` delimited blocks with YAML-like frontmatter; free-text fallback via `importText` IPC; preview count → confirm → bulk insert
- `tui-stats-pane-tabs`: StatsPane tab toggle `[s]`/`[m]`; memories view with `↑↓` scroll, `[Enter]` detail expand

### Modified Capabilities

- `tui-socket-client`: gains `insertMemory()`, `importText()`, `getRecent()`, `reset()` methods
- `tui-layout`: StatusBar gains a hint row; ToastBar and CommandPalette are conditional rows

## Impact

New files:

- `src/components/toast-bar.tsx`
- `src/components/command-palette.tsx`
- `src/components/memory-form.tsx`
- `src/lib/md-parser.ts`

Modified files:

- `src/components/app.tsx`
- `src/components/status-bar.tsx`
- `src/components/stats-pane.tsx`
- `src/components/query-repl.tsx`
- `src/client/socket-client.ts`

## Depends On

- `memory` scope change (tui-memory-management) must land first
- `cortex` scope change (tui-memory-management) must land first
