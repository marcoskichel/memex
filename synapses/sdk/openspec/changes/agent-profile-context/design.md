## Context

`startEngram` spawns cortex as a subprocess and passes config via env vars (see `MEMORY_DB_PATH`, `NEUROME_ENGRAM_ID` pattern in `start-engram.ts`). `agentProfile` maps directly to two new env vars following the same pattern.

## Goals / Non-Goals

**Goals:**

- Add `AgentProfile` type and `agentProfile` field to `StartEngramConfig`
- Forward type and purpose as env vars when spawning cortex
- Export `AgentProfile` from the SDK public index

**Non-Goals:**

- No runtime validation of profile values
- No MCP server config changes

## Decisions

### D1: Conditional env var inclusion matches existing `engramId` and API key patterns

`start-engram.ts` already uses spread conditionals: `...(config.anthropicApiKey !== undefined && { ANTHROPIC_API_KEY: config.anthropicApiKey })`. `agentProfile.type` and `agentProfile.purpose` each follow the same pattern — only included when defined.

### D2: `AgentProfile` defined in `types.ts` and re-exported from `index.ts`

Keeps the type co-located with other SDK config types. No new files needed.

## Risks / Trade-offs

- None. Change is purely additive with no existing behavior affected.
