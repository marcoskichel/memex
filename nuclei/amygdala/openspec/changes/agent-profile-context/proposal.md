## Why

Amygdala scores insights without knowing the agent's goal, causing structurally important events — navigation traces, file edit sequences, interaction patterns — to be skipped as low-importance. The LLM cannot infer importance without knowing what the agent is trying to do.

## What Changes

- `AmygdalaConfig` gains an optional `agentProfile?: AgentProfile` field
- The salience scoring system prompt is extended with agent profile context when present
- No changes to the scoring schema, action decisions, or downstream pipeline

## Capabilities

### New Capabilities

- `amygdala-agent-profile`: Amygdala accepts an optional agent profile (type + purpose) and injects it into the LLM scoring prompt, enabling context-aware importance scoring without heuristics or hardcoded rules per agent type

### Modified Capabilities

- `amygdala-agent-state`: The existing agent-state spec governs how `AgentState` biases the prompt. Agent profile is additive — a second independent context signal layered alongside agent state, not a replacement

## Impact

- `AmygdalaConfig` interface in `nuclei/amygdala`
- System prompt builder in `amygdala-process.ts`
- `synapses/cortex` must read and forward the profile from env vars
- `synapses/sdk` must accept and pass through the profile at startup
