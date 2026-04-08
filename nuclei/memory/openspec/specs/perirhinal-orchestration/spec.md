# perirhinal-orchestration Specification

## Purpose

TBD - created by archiving change wire-perirhinal-entity-extraction. Update Purpose after archive.

## Requirements

### Requirement: createMemory instantiates and schedules EntityExtractionProcess

`createMemory` SHALL instantiate `EntityExtractionProcess` from `@neurome/perirhinal` and subscribe its `run()` to the `amygdala:cycle:end` event so entity extraction fires automatically after each amygdala batch.

#### Scenario: Entity extraction runs after amygdala cycle

- **WHEN** the amygdala completes a cycle and emits `amygdala:cycle:end`
- **THEN** `EntityExtractionProcess.run()` is called without any manual invocation by the caller

#### Scenario: Perirhinal failure does not block next amygdala cycle

- **WHEN** `EntityExtractionProcess.run()` returns an error
- **THEN** the error is handled (logged to stderr) and the next amygdala cycle proceeds normally

#### Scenario: Concurrent amygdala cycles do not cause duplicate runs

- **WHEN** a second `amygdala:cycle:end` fires while perirhinal is still running from the previous cycle
- **THEN** the second `run()` call returns `LOCK_FAILED` and exits cleanly without processing

### Requirement: EmbeddingAdapter is adapted inline for EntityExtractionProcess

The embed function passed to `EntityExtractionProcess` SHALL use the format `"${entity.name} (${entity.type})"` to construct the text string before calling `EmbeddingAdapter.embed()`.

#### Scenario: Entity embedding uses name and type as text

- **WHEN** `EntityExtractionProcess` embeds an entity with name `"Maya Chen"` and type `"person"`
- **THEN** the text `"Maya Chen (person)"` is passed to `EmbeddingAdapter.embed()`

### Requirement: perirhinal:extraction:end event is emitted after each run

After each `EntityExtractionProcess.run()` call completes (success or error), `MemoryImpl` SHALL emit a `perirhinal:extraction:end` event containing `PerirhinalStats` and an optional error type.

#### Scenario: Event emitted on successful run

- **WHEN** `EntityExtractionProcess.run()` returns `Ok<PerirhinalStats>`
- **THEN** `perirhinal:extraction:end` is emitted with the stats and no error field

#### Scenario: Event emitted on failed run

- **WHEN** `EntityExtractionProcess.run()` returns `Err<ExtractionError>`
- **THEN** `perirhinal:extraction:end` is emitted with zero stats and the error type
