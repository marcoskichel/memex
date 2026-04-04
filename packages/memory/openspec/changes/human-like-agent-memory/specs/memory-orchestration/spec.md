## ADDED Requirements

### Requirement: logInsight as sole agent interface

`logInsight(summary, contextFile, tags?)` SHALL be the only method agents call to write to memory. It SHALL internally call `stm.append()`. Agent code SHALL NOT call STM, LTM, amygdala, or hippocampus APIs directly.

#### Scenario: logInsight appends to STM log

- **WHEN** `memory.logInsight('observed X', '/tmp/phase-1.txt', ['tool-use'])` is called
- **THEN** an entry with the given summary, contextFile, and tags appears in `stm.readUnprocessed()`

#### Scenario: tags parameter is optional

- **WHEN** `memory.logInsight(summary, contextFile)` is called without tags
- **THEN** the STM entry is created with an empty tags array and no error is thrown

### Requirement: recall wraps ltm.query for agent use

`recall(nlQuery, options?)` SHALL delegate to `ltm.query()`. The `strengthen` option SHALL default to `false` for pre-task orientation queries.

#### Scenario: recall delegates to ltm.query

- **WHEN** `memory.recall('what did I learn about X?')` is called
- **THEN** `ltm.query('what did I learn about X?', { strengthen: false })` is invoked

#### Scenario: strengthen can be overridden

- **WHEN** `memory.recall(query, { strengthen: true })` is called
- **THEN** `ltm.query(query, { strengthen: true })` is invoked

### Requirement: createMemory initializes all subsystems

`createMemory(options)` SHALL initialize and wire the LTM adapter, STM log, amygdala background process, and hippocampus schedule. It SHALL return a `Memory` instance ready for immediate use.

#### Scenario: All subsystems are running after createMemory

- **WHEN** `createMemory(options)` returns
- **THEN** the amygdala background process is active and the hippocampus schedule is registered

#### Scenario: createMemory with defaults succeeds

- **WHEN** `createMemory({})` is called with no options
- **THEN** a functional `Memory` instance is returned without error

### Requirement: Background processes started automatically

The amygdala and hippocampus background processes SHALL be started as part of `createMemory()` with no additional call required from the agent.

#### Scenario: No separate start call needed

- **WHEN** `createMemory()` is called
- **THEN** both background processes begin running without any subsequent `start()` invocation

### Requirement: Configurable context compression threshold

The context compression threshold SHALL be configurable at `createMemory()` time. The default threshold SHALL be 70% of `maxTokens`.

#### Scenario: Default threshold is 70%

- **WHEN** `createMemory({ maxTokens: 100000 })` is called with no explicit threshold
- **THEN** compression triggers at 70,000 tokens

#### Scenario: Custom threshold is applied

- **WHEN** `createMemory({ maxTokens: 100000, compressionThreshold: 0.5 })` is called
- **THEN** compression triggers at 50,000 tokens

### Requirement: shutdown flushes STM synchronously

`memory.shutdown()` SHALL run one final synchronous amygdala pass to process all remaining unprocessed STM entries before stopping background processes.

#### Scenario: STM fully drained before shutdown completes

- **WHEN** `memory.shutdown()` is called with 5 unprocessed STM entries
- **THEN** all 5 entries are processed and marked before the method returns

#### Scenario: Background processes stopped after flush

- **WHEN** `memory.shutdown()` completes
- **THEN** the amygdala and hippocampus are no longer running and no further cycles will execute

### Requirement: Package encapsulation boundary

Agent code SHALL import exclusively from `@neurokit/memory`. Direct imports from `@neurokit/ltm`, `@neurokit/stm`, `@neurokit/amygdala`, or `@neurokit/hippocampus` by agent code SHALL be a violation of the integration contract.

#### Scenario: All agent-facing types exported from @neurokit/memory

- **WHEN** the `@neurokit/memory` package index is inspected
- **THEN** all types and methods needed for agent integration are re-exported from it

#### Scenario: Sub-packages are not peer dependencies of consumers

- **WHEN** a consuming project's package.json is inspected
- **THEN** only `@neurokit/memory` appears as a dependency; sub-packages are not listed
