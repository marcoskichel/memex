## NEW Requirements

### Requirement: AmygdalaConfig accepts singletonPromotionThreshold

`AmygdalaConfig` SHALL accept `singletonPromotionThreshold?: number`. When omitted, the default SHALL be `0.7`.

#### Scenario: Default threshold is 0.7

- **WHEN** `AmygdalaConfig` is constructed without `singletonPromotionThreshold`
- **THEN** the effective threshold used during `applyAction` is `0.7`

#### Scenario: Custom threshold is respected

- **WHEN** `AmygdalaConfig` is constructed with `singletonPromotionThreshold: 0.9`
- **THEN** only entries with `importanceScore >= 0.9` are eligible for singleton promotion

### Requirement: High-importance singletons are inserted as semantic tier

When `applyAction` processes an `insert` scoring result where `importanceScore >= singletonPromotionThreshold` AND the related memories list passed from `processEntry` is empty, the `ltm.insert()` call SHALL use `tier: 'semantic'`.

#### Scenario: High-importance singleton promoted to semantic

- **WHEN** scoring result is `{ action: 'insert', importanceScore: 0.85 }` and no related memories were found
- **THEN** the LTM record is stored with `tier === 'semantic'`

#### Scenario: High-importance entry with related memories remains episodic

- **WHEN** scoring result is `{ action: 'insert', importanceScore: 0.85 }` and related memories list is non-empty
- **THEN** the LTM record is stored with `tier === 'episodic'`

#### Scenario: Below-threshold insert remains episodic

- **WHEN** scoring result is `{ action: 'insert', importanceScore: 0.5 }` and related memories list is empty
- **THEN** the LTM record is stored with `tier === 'episodic'`

#### Scenario: Singleton promotion does not fire on relate action

- **WHEN** scoring result is `{ action: 'relate', importanceScore: 0.9 }` and related memories list is empty
- **THEN** the LTM record is stored with `tier === 'episodic'`

### Requirement: Singleton promotion does not perform an extra LTM query

The promotion decision SHALL use the related memories list already computed in `processEntry` before calling `applyAction`. `applyAction` SHALL NOT issue a separate `ltm.query()` call to determine singleton status.
