## 1. Types

- [x] 1.1 Add `AgentProfile` interface (`{ type?: string; purpose?: string }`) to `types.ts`
- [x] 1.2 Add `agentProfile?: AgentProfile` to `StartEngramConfig` in `types.ts`
- [x] 1.3 Export `AgentProfile` from `index.ts`

## 2. Wiring

- [x] 2.1 In `startEngram`, conditionally include `AGENT_PROFILE_TYPE` and `AGENT_PROFILE_PURPOSE` in cortex spawn env (when `agentProfile.type` / `agentProfile.purpose` are defined)

## 3. Tests

- [x] 3.1 Unit test: `startEngram` with full `agentProfile` → both env vars present in spawn call
- [x] 3.2 Unit test: `startEngram` without `agentProfile` → neither env var present in spawn call
- [x] 3.3 Unit test: `agentProfile` with only purpose → only `AGENT_PROFILE_PURPOSE` in spawn env
