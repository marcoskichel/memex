# Implementation Tasks

## Type Definitions

- [x] Add `AgentProfile` type import from `@neurome/amygdala` to memory-types.ts
  - Alternative: Define as local re-export if not already exported from amygdala
  - Location: memory-types.ts (top import section)

## Configuration Interface

- [x] Add `agentProfile?: AgentProfile` to `MemoryConfig` interface
  - Location: memory-types.ts line 40 (after agentState)
  - Pattern: Match the style of existing `agentState?: AgentState` at line 54

## Factory Threading

- [x] Pass `agentProfile` through `buildAmygdala` using conditional spread
  - Location: memory-factory.ts line 35 (after agentState spread)
  - Pattern: `...(config.agentProfile !== undefined && { agentProfile: config.agentProfile })`
  - Verify alignment with agentState pattern

## Unit Tests

- [x] Test: createMemory with agentProfile passes it to AmygdalaProcess
  - Assert: AmygdalaProcess constructor receives agentProfile option
  - Assert: amygdala instance has the correct profile

- [x] Test: createMemory without agentProfile — AmygdalaProcess called without agentProfile
  - Assert: AmygdalaProcess instantiated without agentProfile in options
  - Assert: Backward compatibility maintained
