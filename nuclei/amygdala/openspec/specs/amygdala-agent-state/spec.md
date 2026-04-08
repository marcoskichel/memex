# amygdala-agent-state Specification

## Purpose

Allows the current operational mode of an agent to be communicated to amygdala's scoring process, biasing the LLM's importance assessment based on whether the agent is focused, idle, stressed, or learning.

## Requirements

### Requirement: agent-state-scoring

`AgentState` SHALL be `'focused' | 'idle' | 'stressed' | 'learning'` (extensible via string).

`AmygdalaConfig` SHALL accept optional `agentState?: AgentState`.

`AmygdalaProcess` SHALL expose `setAgentState(state: AgentState | undefined): void`.

When `agentState` is provided, the LLM call system prompt SHALL include a one-line state context bias alongside any `agentProfile` context. When both `agentState` and `agentProfile` are present, both SHALL appear in the prompt as independent signals — agent state describes the current operational mode; agent profile describes the persistent identity and goal. When neither is present, behavior is identical to today.

#### Scenario: agentState and agentProfile both present

- **WHEN** amygdala is constructed with both `agentState: 'focused'` and `agentProfile: { purpose: 'Find UI bugs' }`
- **THEN** the system prompt includes the agent profile block before the importance scoring instructions AND appends the state hint at the end

#### Scenario: agentState only, no agentProfile

- **WHEN** amygdala is constructed with `agentState: 'stressed'` and no `agentProfile`
- **THEN** the system prompt appends only the state hint, with no agent profile block
