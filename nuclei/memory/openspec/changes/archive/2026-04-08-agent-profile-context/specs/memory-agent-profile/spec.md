# Memory Agent Profile Specification

## ADDED Requirements

### Requirement: MemoryConfig accepts optional agentProfile

`MemoryConfig` SHALL accept an optional `agentProfile` field with the shape:

```typescript
agentProfile?: { type?: string; purpose?: string }
```

#### Scenario: Creating memory with agentProfile

- **WHEN** `createMemory` is called with config containing `agentProfile`
- **THEN** `MemoryConfig` accepts the `agentProfile` property without error
- **AND** `agentProfile` is stored in the config object

#### Scenario: Creating memory without agentProfile

- **WHEN** `createMemory` is called with config that does not specify `agentProfile`
- **THEN** `MemoryConfig` is valid (`agentProfile` is optional)
- **AND** behavior is identical to before this change

### Requirement: buildAmygdala passes agentProfile to AmygdalaProcess

`buildAmygdala` SHALL thread `agentProfile` from `MemoryConfig` to the `AmygdalaProcess` constructor, following the same spread pattern as `agentState`.

#### Scenario: Building amygdala with agentProfile present

- **WHEN** `buildAmygdala` is called with config containing `agentProfile`
- **THEN** `AmygdalaProcess` is instantiated with `agentProfile` in its options
- **AND** the pattern matches the existing `agentState` threading

#### Scenario: Building amygdala without agentProfile

- **WHEN** `buildAmygdala` is called with config that does not specify `agentProfile`
- **THEN** `AmygdalaProcess` is instantiated without `agentProfile` in its options

### Requirement: Optional behavior without agentProfile

When `agentProfile` is absent from `MemoryConfig`, `AmygdalaProcess` initialization SHALL be identical to the current implementation.

#### Scenario: Backward compatibility

- **WHEN** existing code calls `createMemory` without `agentProfile`
- **THEN** `AmygdalaProcess` is created and started normally
- **AND** no breaking changes occur to the memory initialization flow
