## Context

`AmygdalaProcess.setAgentState()` is now implemented. `Memory` interface needs to
expose it so SDK consumers can adjust scoring context without importing amygdala directly.

## Goals / Non-Goals

**Goals:**

- `Memory.setAgentState()` delegates to `AmygdalaProcess.setAgentState()`
- `AgentState` re-exported from `@memex/memory`
- Optional `agentState?` in `MemoryConfig` passed to amygdala at construction

**Non-Goals:**

- Any state persistence or validation logic (amygdala handles that)

## Decisions

- Thin delegation — no logic in MemoryImpl, just pass-through
- `AgentState` imported from `@memex/amygdala` and re-exported from `@memex/memory`
