## agent-state-scoring (memory)

`Memory` interface SHALL expose `setAgentState(state: AgentState | undefined): void`.

`AgentState` SHALL be re-exported from `@memex/memory`.

`MemoryConfig` SHALL accept optional `agentState?: AgentState` passed to amygdala on construction.
