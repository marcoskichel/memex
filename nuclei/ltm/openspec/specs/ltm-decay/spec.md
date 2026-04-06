## ADDED Requirements

### Requirement: Initial stability from importance

Each record's initial stability SHALL be derived from its importance using the formula `S = 1 × (1 + importance × 9)` in days, giving a range of 1 day (importance=0) to 10 days (importance=1.0).

#### Scenario: Zero importance yields 1-day stability

- **WHEN** a record is inserted with `importance: 0`
- **THEN** its `stability` is `1`

#### Scenario: Full importance yields 10-day stability

- **WHEN** a record is inserted with `importance: 1.0`
- **THEN** its `stability` is `10`

#### Scenario: Mid importance yields proportional stability

- **WHEN** a record is inserted with `importance: 0.5`
- **THEN** its `stability` is `5.5`

### Requirement: Retention decay formula

The engine SHALL compute a record's current retention as `retention = e^(-daysSince / stability)` where `daysSince` is the number of days elapsed since `lastAccessedAt`.

#### Scenario: Retention is 1 immediately after access

- **WHEN** `daysSince` is 0
- **THEN** `retention` is `1.0`

#### Scenario: Retention degrades over time

- **WHEN** `daysSince` equals `stability`
- **THEN** `retention` equals `e^(-1)` ≈ 0.368

#### Scenario: Retention approaches zero for old records

- **WHEN** `daysSince` is many multiples of `stability`
- **THEN** `retention` is close to but never exactly 0

### Requirement: Stability growth on retrieval (spacing effect)

When a record is retrieved and the `strengthen` flag is active, its stability SHALL grow by `growthFactor = 1 + 2.0 × (1 - retention_at_retrieval)`. Records retrieved when nearly forgotten SHALL receive larger stability boosts than those retrieved while still fresh.

#### Scenario: Fresh retrieval yields small growth

- **WHEN** a record is retrieved at `retention ≈ 0.9`
- **THEN** `growthFactor ≈ 1.2` and stability increases by a small amount

#### Scenario: Near-forgotten retrieval yields large growth

- **WHEN** a record is retrieved at `retention ≈ 0.3`
- **THEN** `growthFactor ≈ 2.4` and stability increases by a large amount

### Requirement: Stability ceiling

A record's stability SHALL never exceed `MAX_STABILITY = 365` days regardless of how many times it is retrieved or how large the growth factor is.

#### Scenario: Stability capped at 365 days

- **WHEN** a record's stability would exceed 365 after growth
- **THEN** stability is set to exactly 365

### Requirement: Edge stability derivation

Each relationship edge SHALL have its own initial stability derived from the `importance` of the `fromId` record using the same formula as records. Edges SHALL decay independently of their endpoint records.

#### Scenario: Edge stability matches source importance

- **WHEN** `relate(fromId, toId, type)` is called and `fromId` has `importance: 0.8`
- **THEN** the new edge's initial stability is `1 + 0.8 × 9 = 8.2` days

#### Scenario: Edge decays independently of its nodes

- **WHEN** an edge's `lastAccessedAt` is old but both endpoint records were recently accessed
- **THEN** the edge's retention is low while both records' retentions remain high

### Requirement: Edge stability growth on traversal

When an edge is traversed during a query and `strengthen` is active, the edge's stability SHALL grow using the same spacing-effect formula applied to the edge's own retention at traversal time.

#### Scenario: Traversed edge grows in stability

- **WHEN** an edge with low retention is traversed during a query
- **THEN** the edge's stability grows by a factor proportional to `1 - retention`

### Requirement: Edge stability ceiling

An edge's stability SHALL also be capped at `MAX_STABILITY = 365` days.

#### Scenario: Edge stability does not exceed 365

- **WHEN** an edge's stability would exceed 365 after growth
- **THEN** it is clamped to 365
