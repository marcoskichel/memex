## ADDED Requirements

### Requirement: StartEngramConfig accepts optional agentProfile

`StartEngramConfig` SHALL accept an optional `agentProfile?: AgentProfile` field where `AgentProfile` is `{ type?: string; purpose?: string }`. When absent, behavior SHALL be identical to today.

#### Scenario: startEngram called with agentProfile

- **WHEN** `startEngram({ engramId: 'x', db: '...', agentProfile: { type: 'qa', purpose: 'Find bugs' } })` is called
- **THEN** the spawned cortex process receives `AGENT_PROFILE_TYPE=qa` and `AGENT_PROFILE_PURPOSE=Find bugs` in its environment

#### Scenario: startEngram called without agentProfile

- **WHEN** `startEngram({ engramId: 'x', db: '...' })` is called
- **THEN** neither `AGENT_PROFILE_TYPE` nor `AGENT_PROFILE_PURPOSE` appears in the cortex env

#### Scenario: agentProfile with only purpose

- **WHEN** `agentProfile = { purpose: 'Debug auth flow' }` (no type)
- **THEN** cortex env contains `AGENT_PROFILE_PURPOSE=Debug auth flow` and does NOT contain `AGENT_PROFILE_TYPE`

### Requirement: AgentProfile is exported from the SDK public surface

`AgentProfile` SHALL be exported as a named type from `@neurome/sdk` so consumers can type-check their profiles without reaching into internal packages.

#### Scenario: AgentProfile importable from sdk

- **WHEN** a consumer writes `import type { AgentProfile } from '@neurome/sdk'`
- **THEN** the import resolves without error and the type is `{ type?: string; purpose?: string }`
