## Why

`startEngram` is the single entry point for SDK consumers. Agent profile context must be expressible here — otherwise callers have to manually manage env vars and cortex process spawning to enable it.

## What Changes

- `StartEngramConfig` gains an optional `agentProfile?: { type?: string; purpose?: string }` field
- `startEngram` passes `AGENT_PROFILE_TYPE` and `AGENT_PROFILE_PURPOSE` as env vars when spawning the cortex process
- `AgentProfile` is exported as a named type from the SDK public surface

## Capabilities

### New Capabilities

- `sdk-agent-profile`: `startEngram` accepts an optional `agentProfile` and forwards it to the cortex subprocess via env vars

### Modified Capabilities

(none)

## Impact

- `synapses/sdk` — `types.ts`, `start-engram.ts`, `index.ts`
- Additive only — no existing `StartEngramConfig` consumers break
