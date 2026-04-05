## Why

Hooks currently write directly to SQLite and read context files from disk, giving them independent write authority and bypassing cortex entirely. With cortex exposing a socket, hooks can become thin clients — all memory operations route through the single gateway and the SQLite write path is owned exclusively by cortex.

## What Changes

- `insight-writer.ts`, `context-file-writer.ts`, `context-reader.ts` are removed
- `post-tool-use` sends the raw hook payload to cortex via socket (`logInsight`); cortex writes the SQLite row and context file
- `pre-tool-use` requests context from cortex via socket (`getContext`); cortex runs LTM recall and returns ranked relevant content
- Both hooks use a shared `CortexSocketClient` with a 50ms connect timeout and exit 0 on any failure — hooks never block Claude Code
- **BREAKING**: cortex must be running; if it is not, insights are silently dropped and context injection returns empty

## Capabilities

### New Capabilities

- `hook-socket-client`: Thin socket client shared by both hook binaries — connect, send NDJSON message, optional response read, 50ms hard timeout, exit 0 on failure

### Modified Capabilities

## Impact

- `synapses/claude-hooks/src/shell/clients/` — `insight-writer.ts`, `context-file-writer.ts`, `context-reader.ts` deleted; `cortex-socket-client.ts` added
- `synapses/claude-hooks/src/bin/post-tool-use.ts` — simplified; sends payload via socket
- `synapses/claude-hooks/src/bin/pre-tool-use.ts` — simplified; requests context via socket
- `@memex/stm` dependency removed from claude-hooks (no more direct SQLite access)
