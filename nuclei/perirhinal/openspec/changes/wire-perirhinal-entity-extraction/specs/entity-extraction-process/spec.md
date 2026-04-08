## MODIFIED Requirements

### Requirement: EntityExtractionProcess processes unlinked records in batches

`EntityExtractionProcess` SHALL poll for `LtmRecord` rows that have `metadata.entities` populated but no corresponding `entity_record_links` rows. It SHALL process them in batches, run the full extraction-deduplication-insert pipeline for each, and create `entity_record_links` rows upon completion. The process SHALL use `StorageAdapter.acquireLock` to prevent concurrent runs. `run()` SHALL return `ResultAsync<PerirhinalStats, ExtractionError>` with counts accumulated across the batch.

#### Scenario: Unprocessed record gets entity graph populated

- **WHEN** a record with `metadata.entities: [{ name: 'Alice', type: 'person' }]` has no `entity_record_links` row
- **WHEN** `EntityExtractionProcess` runs
- **THEN** an `EntityNode` exists for Alice, an `entity_record_links` row exists tying Alice's node to the record, and no duplicate node is created for Alice on subsequent runs

#### Scenario: Already-processed record is skipped

- **WHEN** a record already has a corresponding `entity_record_links` row
- **WHEN** `EntityExtractionProcess` runs
- **THEN** no new `EntityNode` or `entity_record_links` rows are created for that record

#### Scenario: Process lock prevents concurrent execution

- **WHEN** `EntityExtractionProcess` holds the lock
- **WHEN** a second instance of `EntityExtractionProcess` attempts to start
- **THEN** the second instance exits without processing any records

#### Scenario: run() returns PerirhinalStats after processing

- **WHEN** `EntityExtractionProcess.run()` completes successfully
- **THEN** it returns `Ok<PerirhinalStats>` with `recordsProcessed` equal to the number of unlinked records that entered the pipeline
