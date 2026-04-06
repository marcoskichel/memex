## MODIFIED Requirements

### Requirement: MemoryConfig requires sessionId

`MemoryConfig` SHALL include `sessionId: string` as a required field. `createMemory()` SHALL pass it to `AmygdalaConfig.sessionId`.

#### Scenario: sessionId wired from MemoryConfig to AmygdalaConfig

- **WHEN** `createMemory({ sessionId: 'session-42', ... })` is called
- **THEN** the internal amygdala instance is constructed with `sessionId === 'session-42'`

#### Scenario: createMemory without sessionId is a type error

- **WHEN** `createMemory({})` is called without `sessionId`
- **THEN** TypeScript reports a type error at compile time
