# Agent Profile Context

## What

Introduce an optional `agentProfile` configuration at engram startup that flows through the system into the Amygdala's salience scoring prompt. The profile carries two fields: `type` (a short categorical label) and `purpose` (free-text description of what the agent is doing).

## Why

Amygdala scores insights without knowing anything about the agent producing them. This causes structurally important events — such as navigation traces from a UI explorer agent, or file edit sequences from a coding agent — to be assigned low importance scores and skipped, because they appear semantically thin in isolation.

The LLM cannot infer importance without knowing the agent's goal. A navigation event is noise to a personal assistant and critical knowledge to a QA agent. The purpose field gives the LLM the context it needs to make that distinction correctly, without heuristics or special-cased logic.

## Scopes

| Scope      | Change                                                                                                              |
| ---------- | ------------------------------------------------------------------------------------------------------------------- |
| `sdk`      | Add `agentProfile` to `StartEngramConfig`; pass through to cortex env vars                                          |
| `cortex`   | Read `AGENT_PROFILE_TYPE` / `AGENT_PROFILE_PURPOSE` env vars; thread into `CortexConfig` and down to `createMemory` |
| `amygdala` | Accept `agentProfile` in `AmygdalaConfig`; inject into the scoring system prompt                                    |

## Shared Contract

The profile is optional everywhere. When absent, behavior is identical to today.

```typescript
interface AgentProfile {
  type?: string; // e.g. 'qa', 'coding', 'research', 'browser'
  purpose?: string; // e.g. "Explore Exodus mobile app UI to find bugs"
}
```

`type` is a light signal for future filtering or analytics. `purpose` is the primary input to the Amygdala prompt — free text lets the LLM reason contextually rather than matching against an enum.

## What This Does Not Do

- No heuristics or pattern matching on insight text
- No hardcoded rules per agent type
- No breaking changes to any existing API
