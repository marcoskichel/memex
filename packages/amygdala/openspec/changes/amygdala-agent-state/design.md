## Context

The amygdala LLM call uses a single static `SYSTEM_PROMPT`. Agent state modulates
how salient the same insight is — a routine tool call during a focused task should
score lower than the same call during an idle session.

## Goals / Non-Goals

**Goals:**

- Optional `agentState` field on `AmygdalaConfig` and a `setAgentState()` runtime method
- State injects a one-line bias hint into the system prompt

**Non-Goals:**

- Multi-level state hierarchies or external state signals
- Changing default behavior when state is absent

## Decisions

- `buildSystemPrompt(state?: AgentState): string` appends a single context line after the base prompt
- `AgentState` is `'focused' | 'idle' | 'stressed' | 'learning'` (string for extensibility)
- `setAgentState(undefined)` resets to default behavior
- No state persistence across process restarts

## Risks / Trade-offs

- [Risk] LLM may not reliably adjust scores based on one-line context
  → Acceptable; low-cost signal with no downside when absent
