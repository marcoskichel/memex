# schedulable-process Specification

## Purpose

TBD - created by archiving change wire-perirhinal-entity-extraction. Update Purpose after archive.

## Requirements

### Requirement: PerirhinalStats captures run metrics

`PerirhinalStats` SHALL be an exported interface with four numeric fields: `recordsProcessed`, `entitiesInserted`, `entitiesReused`, and `errors`. All fields are counts from a single `run()` invocation.

#### Scenario: Stats reflect entities inserted and reused

- **WHEN** `EntityExtractionProcess.run()` processes a record with two new entities and one known entity
- **THEN** the returned `PerirhinalStats` has `entitiesInserted: 2`, `entitiesReused: 1`, `recordsProcessed: 1`, `errors: 0`

#### Scenario: Stats reflect zero when nothing to process

- **WHEN** `EntityExtractionProcess.run()` finds no unlinked records
- **THEN** the returned `PerirhinalStats` has all fields equal to `0`

#### Scenario: Stats reflect errors without throwing

- **WHEN** one record fails during extraction (LLM call fails)
- **THEN** `errors` is incremented and the run still returns `Ok` with remaining records processed

### Requirement: EntityExtractionProcess exports PerirhinalStats from index

`PerirhinalStats` and `EntityExtractionProcess` SHALL be exported from the package root (`index.ts`) so consumers can import them without reaching into internal paths.

#### Scenario: Consumer imports succeed from package root

- **WHEN** a consumer does `import { EntityExtractionProcess, PerirhinalStats } from '@neurome/perirhinal'`
- **THEN** both symbols resolve without error
