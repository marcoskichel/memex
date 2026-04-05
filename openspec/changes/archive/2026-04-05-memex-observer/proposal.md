## Why

External AI agents (e.g. qa-agents explorer) have no persistent memory between runs — they rediscover navigation paths and screen states from scratch every time. Neurokit's memory system can solve this, but there is no published interface for non-Claude-Code consumers to stream observations into it.

## What Changes

- New synapse `synapses/memex-observer` exporting `createMemexObserver(sessionId)`
- Returns a `(event: AgentEvent) => void` callback that is structurally compatible with `@qa-agents/observer`'s `AgentObserver` type — no cross-repo type import required
- Opens one persistent Unix socket connection to the cortex IPC server on creation, buffers events until connected, then streams each agent event as a `logInsight` call
- Degrades silently if cortex is not running — consuming agents are unaffected

## Capabilities

### New Capabilities

- `agent-observer`: A synapse that translates external agent lifecycle events (`STAGE_START`, `STAGE_END`, `THOUGHT`, `TOOL_CALL`, `TOOL_RESULT`) into cortex `logInsight` calls, enabling any agent using the callback observer pattern to feed observations into neurokit's memory pipeline

### Modified Capabilities

## Impact

- New package `synapses/memex-observer` (depends on `@memex/cortex` only)
- No changes to existing packages
- `workspace.yaml` gains a new `memex-observer` scope entry
- Consumers in external repos (e.g. `qa-agents`) add `@memex/observer` as a dependency and pass the returned function as their `onEvent` callback
