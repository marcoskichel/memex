## MODIFIED Requirements

### Requirement: Temporal proximity constraint on consolidation clusters

After `findConsolidationCandidates` returns similarity-based clusters, hippocampus SHALL apply a temporal proximity check to each cluster before passing it to the LLM consolidation step.

For each cluster:

1. Sort records by `createdAt` ascending
2. Compute spread: `max(createdAt) - min(createdAt)` in days
3. If spread exceeds `maxCreatedAtSpreadDays`, find the index of the largest consecutive time gap and split the cluster into two sub-clusters at that index
4. Evaluate each sub-cluster independently against `minClusterSize`; discard any sub-cluster with fewer records than `minClusterSize`
5. Only sub-clusters that pass the size gate proceed to the LLM call

When `maxCreatedAtSpreadDays` is `undefined`, the temporal constraint MUST NOT be applied and all clusters are passed through as-is (existing behaviour).

#### Scenario: Temporally cohesive cluster is not split

- **GIVEN** a cluster of 4 records all created within 10 days
- **AND** `maxCreatedAtSpreadDays` is `30`
- **WHEN** `consolidationPass` evaluates the cluster
- **THEN** the cluster is passed to the LLM intact as a single cluster of 4 records

#### Scenario: Temporally dispersed cluster is split at largest gap

- **GIVEN** a cluster of 6 records: 3 from January (days 1, 5, 8) and 3 from July (days 180, 185, 190)
- **AND** `maxCreatedAtSpreadDays` is `30`
- **WHEN** `consolidationPass` evaluates the cluster
- **THEN** the cluster is split into two sub-clusters: [Jan-1, Jan-5, Jan-8] and [Jul-180, Jul-185, Jul-190]
- **AND** each sub-cluster is evaluated against `minClusterSize` independently

#### Scenario: Split sub-cluster below minClusterSize is discarded

- **GIVEN** a cluster of 4 records: 1 from January and 3 from July
- **AND** `maxCreatedAtSpreadDays` is `30` and `minClusterSize` is `3`
- **WHEN** the cluster is split at the largest gap
- **THEN** the January sub-cluster (size 1) is discarded
- **AND** the July sub-cluster (size 3) proceeds to LLM consolidation
- **AND** the January record remains as an episodic record unchanged

#### Scenario: Temporal constraint disabled when maxCreatedAtSpreadDays is undefined

- **GIVEN** `maxCreatedAtSpreadDays` is `undefined` (not configured)
- **AND** a cluster spans 365 days
- **WHEN** `consolidationPass` evaluates the cluster
- **THEN** no splitting occurs and the cluster is passed to the LLM intact

#### Scenario: Split is at the single largest gap, not every gap above threshold

- **GIVEN** a cluster of 5 records spanning 200 days with gaps of 10, 90, 5, and 80 days between consecutive records
- **AND** `maxCreatedAtSpreadDays` is `30`
- **WHEN** `consolidationPass` evaluates the cluster
- **THEN** the cluster is split at the 90-day gap (the largest gap), producing two sub-clusters
- **AND** no further splitting is attempted within the same run

### Requirement: maxCreatedAtSpreadDays is configurable in HippocampusConfig

`HippocampusConfig` SHALL include `maxCreatedAtSpreadDays?: number`. When set, it MUST be forwarded to `findConsolidationCandidates` as `maxCreatedAtSpreadDays`. The default value when not configured is `30` days.

#### Scenario: Config value used as default spread threshold

- **WHEN** hippocampus is constructed with `maxCreatedAtSpreadDays: 60`
- **THEN** all consolidation passes apply a 60-day temporal spread limit

#### Scenario: Default 30-day spread when config omits the field

- **WHEN** hippocampus is constructed without `maxCreatedAtSpreadDays`
- **THEN** all consolidation passes apply a 30-day temporal spread limit

### Requirement: Hippocampus forwards category to ltm.consolidate

When `HippocampusConfig.category` is set, hippocampus SHALL pass it as `category` in the options to every `ltm.consolidate()` call. When not set, no `category` is forwarded (existing behaviour).

#### Scenario: Category forwarded to consolidated record

- **WHEN** hippocampus is configured with `category: 'world_fact'` and consolidates a cluster
- **THEN** the resulting semantic record has `category === 'world_fact'`

#### Scenario: No category when config omits it

- **WHEN** hippocampus is configured without `category`
- **THEN** consolidated semantic records have `category === undefined`

### Requirement: Context file deletion is unconditional on safeToDelete flag

Hippocampus SHALL delete all context files with `safeToDelete === true` after each prune pass without querying LTM for active references. It MUST NOT perform any cross-reference check before deletion.

#### Scenario: safeToDelete files deleted unconditionally

- **WHEN** hippocampus completes a prune pass and finds context files with `safeToDelete === true`
- **THEN** all such files are deleted regardless of any LTM record state

#### Scenario: Non-safeToDelete files not deleted

- **WHEN** a context file has `safeToDelete === false`
- **THEN** hippocampus does not delete it during the prune pass
