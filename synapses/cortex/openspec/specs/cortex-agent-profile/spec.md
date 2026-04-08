# cortex-agent-profile Specification

## Purpose

TBD - created by archiving change agent-profile-context. Update Purpose after archive.

## Requirements

### Requirement: Cortex reads agent profile from environment variables

`readConfig()` SHALL read `AGENT_PROFILE_TYPE` and `AGENT_PROFILE_PURPOSE` from `process.env`. When either is present, `CortexConfig.agentProfile` SHALL be populated. When both are absent, `agentProfile` SHALL be `undefined`.

#### Scenario: Both env vars set

- **WHEN** `AGENT_PROFILE_TYPE=qa` and `AGENT_PROFILE_PURPOSE=Find UI bugs` are in the environment
- **THEN** `readConfig()` returns `agentProfile: { type: 'qa', purpose: 'Find UI bugs' }`

#### Scenario: Only purpose set

- **WHEN** `AGENT_PROFILE_PURPOSE=Debug authentication flow` is set and `AGENT_PROFILE_TYPE` is absent
- **THEN** `readConfig()` returns `agentProfile: { purpose: 'Debug authentication flow' }` (no `type` key)

#### Scenario: Neither env var set

- **WHEN** neither `AGENT_PROFILE_TYPE` nor `AGENT_PROFILE_PURPOSE` is present
- **THEN** `readConfig()` returns `agentProfile: undefined`

### Requirement: Cortex forwards agentProfile to createMemory

`main()` SHALL pass `agentProfile` from `CortexConfig` into `createMemory`. When `agentProfile` is `undefined`, the call to `createMemory` is unchanged.

#### Scenario: agentProfile forwarded when present

- **WHEN** `CortexConfig.agentProfile` is `{ type: 'qa', purpose: 'Find bugs' }`
- **THEN** `createMemory` is called with `agentProfile: { type: 'qa', purpose: 'Find bugs' }`

#### Scenario: agentProfile absent — no change to createMemory call

- **WHEN** `CortexConfig.agentProfile` is `undefined`
- **THEN** `createMemory` is called without an `agentProfile` argument (or with `undefined`), identical to current behavior
