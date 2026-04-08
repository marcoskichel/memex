## ADDED Requirements

### Requirement: Superseded results include their superseding companion

When a query result has `isSuperseded=true`, the LTM query engine SHALL append the
superseding record to the result set if it is not already present. The injected record
SHALL have `retrievalStrategies: ['companion']` and `isSuperseded: false`. Companion
injection is limited to one hop: companions are NOT themselves checked for supersession.

#### Scenario: Superseded result triggers companion injection

- **WHEN** record A is superseded by record B, and a query returns record A with `isSuperseded=true`, and record B is not independently in the result set
- **THEN** record B is appended to the result set with `retrievalStrategies: ['companion']` and `isSuperseded: false`

#### Scenario: Companion already in result set is not duplicated

- **WHEN** record A is superseded by record B, and both A and B independently score above threshold
- **THEN** record B appears exactly once in the result set (no duplication)

#### Scenario: Missing or tombstoned companion is skipped

- **WHEN** record A is superseded by record B, but record B has been deleted
- **THEN** record A is returned normally; no companion is injected; no error is thrown

#### Scenario: Cascade is capped at one hop

- **WHEN** record A is superseded by B, and B is superseded by C, and a query returns A with `isSuperseded=true`
- **THEN** B is injected as a companion, but C is NOT injected (one-hop cap)

### Requirement: applySupersedes returns superseding record IDs

`applySupersedes` SHALL return `{ isSuperseded: boolean; supersedingIds: number[] }`
where `supersedingIds` contains the `fromId` of each live supersedes edge. This avoids
a second `edgesTo` call during companion injection.

#### Scenario: Return value includes superseding IDs

- **WHEN** record A has one incoming supersedes edge from record B with live retention
- **THEN** `applySupersedes` returns `{ isSuperseded: true, supersedingIds: [B.id] }`
