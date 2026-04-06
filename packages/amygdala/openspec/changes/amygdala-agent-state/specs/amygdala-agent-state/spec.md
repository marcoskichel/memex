## agent-state-scoring

`AgentState` SHALL be `'focused' | 'idle' | 'stressed' | 'learning'` (extensible via string).

`AmygdalaConfig` SHALL accept optional `agentState?: AgentState`.

`AmygdalaProcess` SHALL expose `setAgentState(state: AgentState | undefined): void`.

When `agentState` is provided, the LLM call system prompt SHALL include a one-line
state context bias. When absent, behavior is identical to today.
