## MODIFIED Requirements

### Requirement: recall accepts optional current-position fields via RecallOptions

`RecallOptions` SHALL be extended with a discriminated union of `currentEntityIds` and `currentEntityHint`. The full updated signature is:

```typescript
type RecallEntityPosition =
  | { currentEntityIds: number[]; currentEntityHint?: never }
  | { currentEntityHint: string[]; currentEntityIds?: never }
  | { currentEntityIds?: never; currentEntityHint?: never };

type RecallOptions = LtmQueryOptions & RecallEntityPosition;
```

Supplying both fields simultaneously SHALL be a compile-time error (enforced by the discriminated union). Supplying neither is valid and preserves backwards-compatible behaviour — no enrichment is performed.

`RecallResult` SHALL be extended with an optional `entityContext?: EntityContext` field, where `EntityContext` is:

```typescript
interface EntityContext {
  entities: EntityNode[];
  selectedEntity: EntityNode;
  originEntity: EntityNode | null;
  navigationPath: EntityPathStep[] | null;
  pathReliability: 'ok' | 'degraded';
  entityResolved: boolean;
}
```

#### Scenario: existing callers unchanged — no entityContext on results

- **WHEN** `recall(query)` is called with no position fields (existing usage)
- **THEN** results are returned without `entityContext` — behaviour is identical to before this change

#### Scenario: currentEntityIds accepted at compile time

- **WHEN** `recall(query, { currentEntityIds: [1, 2] })` is called
- **THEN** TypeScript accepts the call without type errors

#### Scenario: currentEntityHint accepted at compile time

- **WHEN** `recall(query, { currentEntityHint: ['settings screen', 'profile page'] })` is called
- **THEN** TypeScript accepts the call without type errors

#### Scenario: both fields simultaneously rejected at compile time

- **WHEN** `recall(query, { currentEntityIds: [1], currentEntityHint: ['foo'] })` is called
- **THEN** TypeScript produces a type error — the combination is illegal
