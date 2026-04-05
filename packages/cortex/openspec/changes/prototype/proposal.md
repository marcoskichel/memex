## Why

The `AmygdalaProcess` and `HippocampusProcess` must run in a single long-lived process — re-instantiating them per hook invocation is unusable because TransformersJS cold-start is expensive, and amygdala cadence timers require continuity across tool calls. A dedicated daemon solves both constraints.

## What Changes

- Add new `packages/cortex` workspace package (`@neurokit/cortex`)
- Package has a `bin` entry: `cortex` → `dist/bin/cortex.js`
- Boot sequence calls `createMemory()` from `@neurokit/memory` with `SqliteInsightLog` from `@neurokit/stm`
- SIGTERM/SIGINT handlers call `memory.shutdown()` then exit
- All configuration read from env vars; process exits with code 1 on missing required vars
- `synapses/claude-hooks` added to `pnpm-workspace.yaml` alongside this package

## Capabilities

### New Capabilities

- `cortex-daemon`: A runnable process that boots the full neurokit memory stack (LTM engine, amygdala daemon, hippocampus daemon), keeps it alive, and shuts down cleanly on signal. Reads `MEMORY_DB_PATH`, `ANTHROPIC_API_KEY`, and optionally `MEMORY_SESSION_ID` from the environment.

### Modified Capabilities

_(none — no existing spec-level requirements are changing)_

## Impact

- `packages/cortex/` — new package, new `package.json`, `tsconfig.json`, `src/bin/cortex.ts`
- `pnpm-workspace.yaml` — add `synapses/*` entry
- No changes to any existing package
- Downstream: `synapses/claude-hooks` writes to the same SQLite file this daemon reads
