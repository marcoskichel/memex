## MODIFIED Requirements

### Requirement: agent-state-scoring

`AgentState` SHALL be `'focused' | 'idle' | 'stressed' | 'learning'` (extensible via string).

`AmygdalaConfig` SHALL accept optional `agentState?: AgentState`.

`AmygdalaProcess` SHALL expose `setAgentState(state: AgentState | undefined): void`.

When `agentState` is provided, the LLM call system prompt SHALL include a one-line state context bias alongside any `agentProfile` context. When both `agentState` and `agentProfile` are present, both SHALL appear in the prompt as independent signals — agent state describes the current operational mode; agent profile describes the persistent identity and goal. When neither is present, behavior is identical to today.
