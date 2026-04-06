## Why

The amygdala scoring prompt is static — it scores every insight the same way regardless of what the agent is doing. Real amygdala salience is modulated by neuromodulatory context: a threat during an active task is scored differently than the same threat during rest. Allowing callers to pass an optional agent state biases importance scoring to match the operational context, without breaking existing integrations.

## What Changes

- `AmygdalaConfig` SHALL accept an optional `agentState` field of type `AgentState`.
- `AgentState` is a string union: `'focused' | 'idle' | 'stressed' | 'learning'`. Callers may also pass any string for extensibility.
- When `agentState` is provided, the scoring system prompt SHALL include a context line that informs the LLM of the current state and its implication for scoring:
  - `focused` → slightly raise bar for distraction (routine tool calls score lower)
  - `idle` → score normally (default behaviour)
  - `stressed` → lower threshold for high-importance items (bias toward flagging more things as significant)
  - `learning` → raise importance for novel/unexpected observations
- When `agentState` is absent or `undefined`, behaviour is identical to today (backward-compatible).
- `agentState` MAY be updated at runtime via a new `setAgentState(state: AgentState | undefined)` method on `AmygdalaProcess`.
- `Memory` interface SHALL expose `setAgentState(state: AgentState | undefined): void` to thread the value through.

## Capabilities

### New Capabilities

- `agent-state-scoring`: Amygdala importance scoring is optionally biased by agent operational state.

### Modified Capabilities

- `amygdala-process`: System prompt generation includes optional agent state context line.

## Impact

- `packages/amygdala/src/amygdala-schema.ts` — add `AgentState` type, update `buildPrompt`/`buildPromptWithContext` to accept optional state
- `packages/amygdala/src/amygdala-process.ts` — add `agentState` to config, add `setAgentState()` method
- `packages/memory/src/memory-types.ts` — add `setAgentState()` to `Memory` interface, export `AgentState`
- `packages/memory/src/memory-impl.ts` — delegate `setAgentState()` to `AmygdalaProcess`
- No changes to LTM, STM, or cortex required
