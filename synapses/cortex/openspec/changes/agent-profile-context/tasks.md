## 1. Config

- [x] 1.1 Add `agentProfile?: { type?: string; purpose?: string }` to `CortexConfig` in `cortex-core.ts`
- [x] 1.2 Read `AGENT_PROFILE_TYPE` and `AGENT_PROFILE_PURPOSE` in `readConfig()`; populate `agentProfile` when either is present

## 2. Wiring

- [x] 2.1 Pass `agentProfile` into `createMemory` call in `main()` (spread conditional, matching the `engramId` pattern)

## 3. Tests

- [x] 3.1 Unit test `readConfig()`: both vars set → `agentProfile` populated correctly
- [x] 3.2 Unit test `readConfig()`: only purpose set → `agentProfile` has purpose only
- [x] 3.3 Unit test `readConfig()`: neither var set → `agentProfile` is `undefined`
