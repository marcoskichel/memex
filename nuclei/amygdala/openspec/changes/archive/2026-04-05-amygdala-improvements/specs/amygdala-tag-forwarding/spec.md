## NEW Requirements

### Requirement: Agent-supplied tags are forwarded to LtmRecord.metadata.tags

When amygdala inserts a record into LTM (action `insert` or `relate`), the `InsightEntry.tags` minus internal amygdala tags SHALL be written to `metadata.tags` on the inserted record.

Internal amygdala tags that MUST NOT be forwarded: `permanently_skipped`, `llm_rate_limited`.

#### Scenario: Agent tags forwarded on insert

- **WHEN** `InsightEntry.tags = ['behavioral', 'preference']` and action is `insert`
- **THEN** the LTM record's `metadata.tags` is `['behavioral', 'preference']`

#### Scenario: Agent tags forwarded on relate

- **WHEN** `InsightEntry.tags = ['behavioral']` and action is `relate`
- **THEN** the newly inserted LTM record's `metadata.tags` is `['behavioral']`

#### Scenario: Internal tags are excluded from forwarding

- **WHEN** `InsightEntry.tags = ['behavioral', 'llm_rate_limited', 'permanently_skipped']`
- **THEN** the LTM record's `metadata.tags` is `['behavioral']`

#### Scenario: No agent tags results in empty tags array

- **WHEN** `InsightEntry.tags = []`
- **THEN** the LTM record's `metadata.tags` is `[]`

#### Scenario: Only internal tags results in empty tags array

- **WHEN** `InsightEntry.tags = ['llm_rate_limited']`
- **THEN** the LTM record's `metadata.tags` is `[]`

### Requirement: Internal tags constant is module-level

The set of excluded internal tags SHALL be defined as a module-level constant `INTERNAL_TAGS` in `amygdala-schema.ts`. The tag filtering logic SHALL reference this constant rather than inline string literals.
