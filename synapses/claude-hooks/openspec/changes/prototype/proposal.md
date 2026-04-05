## Why

Claude Code fires lifecycle hooks (`PostToolUse`, `PreToolUse`) as short-lived child processes with JSON payloads on stdin. Without a hook adapter, all tool calls are invisible to neurokit — no insights are captured, no memories are injected into context. This adapter closes the loop between Claude Code's event system and the neurokit memory pipeline.

## What Changes

- Add new `synapses/claude-hooks` workspace package (no npm name needed — private, not published)
- `post-tool-use` hook script: reads hook payload from stdin, writes one `InsightEntry` row to SQLite via `SqliteInsightLog`, writes a context file to `$MEMORY_CONTEXT_DIR/<session-id>/<timestamp>-tool-result.md`
- `pre-tool-use` hook script: reads context files from `$MEMORY_CONTEXT_DIR/<session-id>/`, formats the most recent recalled memories, writes them to stdout (Claude Code injects stdout from `PreToolUse` hooks into the system prompt)
- No dependency on `@neurokit/cortex` at runtime — hooks are stateless SQLite writers/readers

## Capabilities

### New Capabilities

- `post-tool-use-hook`: Stateless hook that opens SQLite, appends one insight row describing the tool call result, writes a context file, and exits. Works whether or not the cortex daemon is running.
- `pre-tool-use-hook`: Stateless hook that reads context files written by `HippocampusProcess` and formats them for system prompt injection. Falls back to empty output if no context exists yet.

### Modified Capabilities

_(none — no existing spec-level requirements are changing)_

## Impact

- `synapses/claude-hooks/` — new package directory
- `pnpm-workspace.yaml` — `synapses/*` entry (added by `packages/cortex` change)
- No changes to any existing package
- Requires `sqlite-stm` change to be merged for `SqliteInsightLog`
- Requires `@neurokit/ltm` for direct LTM SQLite reads (context file lookup)
