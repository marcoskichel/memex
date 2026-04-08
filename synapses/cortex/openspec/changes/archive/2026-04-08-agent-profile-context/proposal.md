## Why

Cortex is the process boundary between the SDK and the memory pipeline. It reads configuration from env vars and wires up `createMemory`. Agent profile context must flow through this boundary — if cortex doesn't read and forward it, it can never reach Amygdala.

## What Changes

- `readConfig()` reads two new optional env vars: `AGENT_PROFILE_TYPE` and `AGENT_PROFILE_PURPOSE`
- `CortexConfig` gains an optional `agentProfile?: { type?: string; purpose?: string }` field
- `main()` passes `agentProfile` into `createMemory`

## Capabilities

### New Capabilities

- `cortex-agent-profile`: Cortex reads `AGENT_PROFILE_TYPE` and `AGENT_PROFILE_PURPOSE` env vars and forwards them as `agentProfile` to `createMemory`, making agent profile context available to the Amygdala scoring loop

### Modified Capabilities

(none — no existing spec-level requirements change)

## Impact

- `synapses/cortex` — `cortex-core.ts`: `readConfig`, `CortexConfig`, `main`
- Callers (SDK, CLI) can now pass profile via env vars
- No changes to the IPC protocol or socket server
