## Why

The `Memory` interface has no way to communicate agent operational state to the amygdala. Without this, even if `AmygdalaProcess` supports `setAgentState()`, callers using the high-level `Memory` abstraction cannot access it.

## What Changes

- `Memory` interface SHALL expose `setAgentState(state: AgentState | undefined): void`.
- `AgentState` SHALL be exported from `@memex/memory` (re-exported from `@memex/amygdala`).
- `MemoryConfig` SHALL accept an optional `agentState?: AgentState` field passed through to `AmygdalaProcess` on construction.
- `MemoryImpl` SHALL delegate `setAgentState()` to `AmygdalaProcess.setAgentState()`.

## Capabilities

### Modified Capabilities

- (none — new interface method, additive; `AgentState` is a new export)

## Impact

- `packages/memory/src/memory-types.ts` — add `setAgentState()` to `Memory` interface; re-export `AgentState`; add `agentState?` to `MemoryConfig`
- `packages/memory/src/memory-impl.ts` — delegate `setAgentState()` to `this.amygdala.setAgentState()`
- `packages/memory/src/memory-factory.ts` — pass `agentState` from config to `AmygdalaProcess` constructor
