# Agent Profile Context in Memory

## Why

Memory is the critical adapter layer between cortex configuration and AmygdalaProcess. The data flow is:
`SDK → cortex (env vars) → createMemory (nuclei/memory) → buildAmygdala → AmygdalaProcess`

Without threading `agentProfile` through memory, the profile configured at the SDK/cortex level never reaches the amygdala, breaking the complete flow of agent context initialization.

## What Changes

- Add `agentProfile?` to `MemoryConfig` interface (mirrors existing `agentState` pattern)
- Thread `agentProfile` through `buildAmygdala` to AmygdalaProcess
- When absent, behavior is identical to today

## New Capability

`memory-agent-profile` — ability for memory layer to pass agent profile metadata to amygdala for cognitive context initialization.

## Impact

- `nuclei/memory/src/memory-types.ts` — MemoryConfig interface
- `nuclei/memory/src/memory-factory.ts` — buildAmygdala function
