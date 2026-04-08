### Requirement: E2E script consolidates a qualifying cluster

The e2e script SHALL insert 3+ semantically similar episodic records, seed their access counts to meet `minAccessCount`, run `HippocampusProcess.run()`, and assert that a consolidated record was produced.

#### Scenario: Baseline consolidation

- **WHEN** 3 semantically similar records are inserted and their access counts reach the threshold and `run()` is called
- **THEN** `ltm.consolidate` is called and the LTM record count decreases (hard assert); the summary content is logged (soft warn)

### Requirement: E2E script validates temporal splitting

The e2e script SHALL insert two groups of similar records with timestamps separated by more than `maxCreatedAtSpreadDays`, run `run()`, and assert that two independent consolidations occurred.

#### Scenario: Two temporal clusters consolidated separately

- **WHEN** 3 records dated January 2024 and 3 records dated July 2024 (same topic) are inserted with seeded access counts and `run()` is called
- **THEN** two separate consolidations occur (hard assert on consolidated cluster count)

### Requirement: E2E script validates minimum cluster size guard

The e2e script SHALL insert fewer records than `minClusterSize` (even if similar) and assert no consolidation occurs.

#### Scenario: Below-threshold cluster skipped

- **WHEN** only 2 similar records exist (below default `minClusterSize: 3`) and `run()` is called
- **THEN** no consolidation occurs and LTM record count is unchanged (hard assert)

### Requirement: E2E script validates prune after consolidation

The e2e script SHALL assert that `ltm.prune()` removes source records whose stability was deflated by consolidation.

#### Scenario: Source records pruned post-consolidation

- **WHEN** consolidation completes and source records have deflated stability
- **THEN** total LTM record count after run is less than before (hard assert)

### Requirement: E2E script validates STM-based context file cleanup

The e2e script SHALL create real temp context files, append `InsightLog` entries with `safeToDelete: true`, run `run()`, and assert the files are deleted.

#### Scenario: Safe-to-delete context files removed

- **WHEN** STM entries reference real temp files with `safeToDelete: true` and `run()` is called
- **THEN** those temp files no longer exist on disk (hard assert)

### Requirement: E2E script validates lock contention

The e2e script SHALL manually acquire the `hippocampus` lock, call `run()`, and assert no consolidation or prune occurred.

#### Scenario: Lock contention defers full cycle

- **WHEN** the `hippocampus` lock is held externally and `run()` is called
- **THEN** the cycle is deferred: no LTM consolidation and no prune
