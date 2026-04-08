## Why

The dendrite MCP server is read-only. AI agents using it can recall memory but cannot log observations. `logInsight` exists in `AxonClient` but is never exposed as an MCP tool. Gating it on an `accessMode` env var keeps the default safe (read-only) while enabling write access for agents that need it.

## What Changes

- Read `NEUROME_ACCESS_MODE` env var in `bin/dendrite.ts`; pass to `run()`
- Thread `accessMode` through `index.ts` `run()` into `server.ts` `createServer()`
- Add `registerLogInsight()` in `server.ts`; register it when `accessMode === 'full'`

## Capabilities

### New Capabilities

- `log-insight-tool`: MCP tool `log_insight` that accepts a single string and calls `axon.logInsight({ summary, contextFile: '' })`
- `access-mode-gating`: Conditional tool registration based on `NEUROME_ACCESS_MODE` env var

### Modified Capabilities

## Impact

- `synapses/dendrite/src/bin/dendrite.ts` — read env var, pass to `run()`
- `synapses/dendrite/src/index.ts` — thread `accessMode` param
- `synapses/dendrite/src/server.ts` — `registerLogInsight`, updated `createServer` signature
