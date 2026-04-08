## ADDED Requirements

### Requirement: MemoryStats includes perirhinal field

`MemoryStats` SHALL include a `perirhinal` field of type `PerirhinalStats` (imported from `@neurome/perirhinal`) containing the stats from the most recent `EntityExtractionProcess.run()` call.

#### Scenario: getStats returns perirhinal stats after extraction run

- **WHEN** perirhinal has completed at least one run
- **THEN** `memory.getStats()` returns a `perirhinal` field with non-zero `recordsProcessed` if records were processed

#### Scenario: getStats returns zero perirhinal stats before first run

- **WHEN** perirhinal has not yet run
- **THEN** `memory.getStats()` returns `perirhinal` with all fields equal to `0`

### Requirement: MemoryImplDeps accepts optional perirhinalProcess

`MemoryImplDeps` SHALL include an optional `perirhinalProcess: EntityExtractionProcess` field. When provided, `MemoryImpl` subscribes it to `amygdala:cycle:end`. When absent, no entity extraction is scheduled.

#### Scenario: MemoryImpl without perirhinalProcess is valid

- **WHEN** `MemoryImpl` is constructed without `perirhinalProcess`
- **THEN** no entity extraction runs and no errors are thrown
