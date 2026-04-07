## MODIFIED Requirements

### Requirement: MemoryConfig requires sessionId

`MemoryConfig` SHALL include `sessionId: string` as a required field. `createMemory()` SHALL pass it to `AmygdalaConfig.sessionId`.

#### Scenario: sessionId wired from MemoryConfig to AmygdalaConfig

- **WHEN** `createMemory({ sessionId: 'session-42', ... })` is called
- **THEN** the internal amygdala instance is constructed with `sessionId === 'session-42'`

#### Scenario: createMemory without sessionId is a type error

- **WHEN** `createMemory({})` is called without `sessionId`
- **THEN** TypeScript reports a type error at compile time

### Requirement: recall() defaults minResults to 1

`Memory.recall()` SHALL pass `minResults: 1` as the default to `ltm.query()` unless the caller explicitly overrides it. Caller-supplied options take precedence.

#### Scenario: Open query always returns at least one record when any candidate exists

- **WHEN** `memory.recall('what have I been working on')` is called with no threshold-passing records but at least one candidate with cosine similarity > 0.05
- **THEN** one record is returned

#### Scenario: Caller can override minResults to 0 for strict mode

- **WHEN** `memory.recall('topic', { minResults: 0 })` is called
- **THEN** only records passing the threshold are returned; empty results are possible

#### Scenario: recallSession is unaffected

- **WHEN** `memory.recallSession('topic', { sessionId: 'abc' })` is called and no records pass the threshold
- **THEN** an empty array is returned (minResults default does not apply to recallSession)

### Requirement: recall() supports entity filtering via LtmQueryOptions passthrough

`Memory.recall()` SHALL accept `entityName?: string` and `entityType?: EntityType` in its options and pass them through to `ltm.query()` unmodified.

#### Scenario: recall with entityName returns only entity-matching records

- **WHEN** `memory.recall('preferences', { entityName: 'marcos' })` is called
- **THEN** only LTM records whose `metadata.entities` contains an entry with name matching 'marcos' (case-insensitive) are returned

#### Scenario: recall with entityType returns only type-matching records

- **WHEN** `memory.recall('tools', { entityType: 'tool' })` is called
- **THEN** only LTM records with at least one entity of type `'tool'` in `metadata.entities` are returned
