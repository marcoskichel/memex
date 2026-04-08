## Context

`cortex-core.ts` contains `CortexConfig`, `readConfig()`, and `main()`. The `engramId` field already follows the optional-env-var-forwarded-to-createMemory pattern. `agentProfile` follows the same shape.

## Goals / Non-Goals

**Goals:**

- Read `AGENT_PROFILE_TYPE` and `AGENT_PROFILE_PURPOSE` from env
- Add `agentProfile` to `CortexConfig` and thread it into `createMemory`

**Non-Goals:**

- No IPC protocol changes — profile is startup config, not a runtime message
- No validation of profile values — free text passes through as-is

## Decisions

### D1: Two flat env vars, not a JSON blob

`AGENT_PROFILE_TYPE=qa` and `AGENT_PROFILE_PURPOSE=Find UI bugs` are simpler to set in shell, docker, and SDK spawn env than a JSON-encoded string. The struct is shallow (two optional strings) so flat vars are the right granularity.

\*\*Rejected alternative — `AGENT_PROFILE={"type":"qa","purpose":"..."}`: JSON in env vars is fragile (quoting, escaping). Two flat vars are unambiguous.

### D2: `agentProfile` is omitted from `CortexConfig` when both vars are absent

Consistent with how `engramId` is handled — only present if the env var exists. Avoids polluting `createMemory` with an empty object.

## Risks / Trade-offs

- [Env var naming] `AGENT_PROFILE_TYPE` and `AGENT_PROFILE_PURPOSE` are new names with no collision risk in the current env surface. → No mitigation needed.
