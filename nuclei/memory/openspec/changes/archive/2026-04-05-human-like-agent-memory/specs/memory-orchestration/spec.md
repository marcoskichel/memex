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

### Requirement: createMemory returns { memory, startupStats }

`createMemory(config)` SHALL return `{ memory: Memory, startupStats: MemoryStats }` rather than a bare `Memory` instance. This is a breaking change. The `startupStats` expose inherited state from a prior session, which is operationally critical on crash recovery.

#### Scenario: createMemory returns both fields

- **WHEN** `createMemory(config)` is called
- **THEN** the return value has a `memory` field and a `startupStats` field

#### Scenario: startupStats reflects inherited state

- **WHEN** `createMemory(config)` is called after a prior crashed session left STM entries
- **THEN** `startupStats.stm.pendingInsights` reflects the count of entries inherited from the crashed session

### Requirement: Orphan recovery on startup

During startup, `createMemory()` SHALL detect STM entries that are `processed = false` but whose `contextFile` no longer exists on disk. These SHALL be marked `importance_scoring_failed` so they rejoin the first amygdala cycle rather than blocking indefinitely.

#### Scenario: Orphaned entries are recovered

- **WHEN** `createMemory()` is called and two STM entries reference missing context files
- **THEN** both entries are marked `importance_scoring_failed` before the first amygdala cycle runs

#### Scenario: Entries with existing context files are not affected

- **WHEN** `createMemory()` runs orphan recovery
- **THEN** entries whose context files exist on disk remain in their current state

### Requirement: Ordered shutdown with ShutdownReport

`memory.shutdown()` SHALL execute an ordered 6-step shutdown and return a `ShutdownReport`: (1) gate new writes (subsequent `logInsight()` throws `ShutdownError`), (2) flush STM compression, (3) run final amygdala pass, (4) wait for in-progress hippocampus cycle or skip, (5) close SQLite, (6) return report with `sessionId`, `shutdownAt`, `durationMs`, `stmPhasesCompressed`, `insightsDrained`, `hippocampusCycleWaitedMs`, `ltmRecordsAtClose`, `contextFilesRemainingOnDisk`.

#### Scenario: logInsight throws after shutdown called

- **WHEN** `memory.shutdown()` has been called
- **THEN** any subsequent `memory.logInsight()` call throws `ShutdownError`

#### Scenario: shutdown drains all pending STM entries

- **WHEN** `memory.shutdown()` is called with 5 unprocessed STM entries
- **THEN** all 5 are processed in the final amygdala pass before `shutdown()` returns

#### Scenario: ShutdownReport includes accurate counts

- **WHEN** `memory.shutdown()` returns
- **THEN** `insightsDrained` equals the number of entries processed in the final amygdala pass

### Requirement: getStats returns MemoryStats

`memory.getStats()` SHALL return a `MemoryStats` object with sub-interfaces: `ltm` (totalRecords, episodicCount, semanticCount, tombstonedCount, averageRetention, belowThresholdCount, totalEdges, averageEdgeRetention), `stm` (pendingInsights, averageInsightAgeMs, oldestInsightAgeMs), `amygdala` (lastCycleStartedAt, lastCycleDurationMs, lastCycleInsightsProcessed, lastCycleFailures, sessionTotalLlmCalls, sessionEstimatedTokens), `hippocampus` (lastConsolidationAt, lastRunClustersConsolidated, lastRunRecordsPruned, falseMemoryCandidates, nextScheduledRunAt), and `disk` (contextFilesOnDisk, contextTotalBytes, oldestContextFileAgeMs, contextDir). It SHALL be callable at any time including during shutdown.

#### Scenario: getStats is callable during shutdown

- **WHEN** `memory.shutdown()` is in progress
- **THEN** `memory.getStats()` returns a valid `MemoryStats` without throwing

#### Scenario: falseMemoryCandidates counts low-confidence semantic records

- **WHEN** 3 semantic records have `metadata.confidence < 0.5`
- **THEN** `getStats().hippocampus.falseMemoryCandidates` equals 3

### Requirement: pruneContextFiles removes safe-to-delete files older than threshold

`memory.pruneContextFiles({ olderThanDays: number })` SHALL delete context files where `safeToDelete = true` AND `age >= olderThanDays`. It SHALL NEVER delete context files where the associated insight is still pending, regardless of age. It SHALL return `PruneContextFilesReport` with `deletedCount`, `deletedBytes`, `skippedCount`, and `errors`.

#### Scenario: Old safe-to-delete files are deleted

- **WHEN** `pruneContextFiles({ olderThanDays: 7 })` is called and a file is 10 days old with `safeToDelete = true`
- **THEN** the file is deleted and counted in `deletedCount`

#### Scenario: Pending files are never deleted regardless of age

- **WHEN** `pruneContextFiles({ olderThanDays: 1 })` is called and a file is 30 days old but its insight is still pending
- **THEN** the file is NOT deleted and appears in `skippedCount`

### Requirement: memory.events typed event emitter

`memory.events` SHALL be a typed `MemoryEventEmitter` (a Node.js `EventEmitter` subclass) that emits all events in the `MemoryEvents` catalog: `amygdala:cycle:start`, `amygdala:cycle:end`, `amygdala:entry:scored`, `hippocampus:consolidation:start`, `hippocampus:consolidation:end`, `hippocampus:false-memory-risk`, `ltm:record:decayed-below-threshold`, `ltm:prune:executed`, `stm:compression:triggered`. Multiple independent consumers SHALL be able to attach listeners without coordination.

#### Scenario: Consumers can attach to memory.events

- **WHEN** `memory.events.on('amygdala:cycle:end', handler)` is called
- **THEN** `handler` is called on every subsequent `amygdala:cycle:end` emission

#### Scenario: Multiple consumers receive the same event

- **WHEN** two listeners are attached for `ltm:record:decayed-below-threshold`
- **THEN** both are called when the event fires
