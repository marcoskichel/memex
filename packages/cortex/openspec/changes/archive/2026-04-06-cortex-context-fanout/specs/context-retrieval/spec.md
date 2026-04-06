## ADDED Requirements

### Requirement: Multi-query fan-out on getContext

`getContext` SHALL issue at least three parallel LTM recall queries for each invocation:

1. A primary query using `JSON.stringify(toolInput)`
2. A secondary query targeting agent identity and session goals
3. A secondary query targeting project and task context

All three queries SHALL be initiated concurrently.

#### Scenario: Three queries run in parallel

- **WHEN** `getContext` is called with any tool input
- **THEN** three LTM recall queries are initiated concurrently before any result is awaited

#### Scenario: Primary query uses serialized tool input

- **WHEN** `getContext` is called with `toolInput: { file_path: "/tmp/foo.ts" }`
- **THEN** the primary query text is `'{"file_path":"/tmp/foo.ts"}'`

### Requirement: Result deduplication by record ID

Results from all queries SHALL be merged and deduplicated by `record.id`. When the same record appears in multiple query results, only one instance SHALL be retained.

#### Scenario: Duplicate record appears in multiple queries

- **WHEN** a record with `id: 42` is returned by both the primary and a secondary query
- **THEN** the merged result set contains exactly one entry with `record.id === 42`

### Requirement: Results sorted by effectiveScore and capped

The merged result set SHALL be sorted by `effectiveScore` descending and truncated to `RECALL_LIMIT_FOR_CONTEXT` entries before being formatted and returned.

#### Scenario: Result cap enforced after merge

- **WHEN** the three queries collectively return 9 unique records
- **THEN** the formatted output contains at most `RECALL_LIMIT_FOR_CONTEXT` records

#### Scenario: Highest scoring records are preferred

- **WHEN** the primary query returns a record with `effectiveScore: 0.8` and a secondary query returns a record with `effectiveScore: 0.6`
- **THEN** the record with `effectiveScore: 0.8` appears before the record with `effectiveScore: 0.6` in the output

### Requirement: Secondary query failure does not fail getContext

If one or more secondary queries fail or return an error result, `getContext` SHALL still return results from the remaining successful queries. The call SHALL NOT throw.

#### Scenario: Secondary query returns error

- **WHEN** one secondary query returns `Err(...)`
- **THEN** `getContext` completes successfully using results from the other queries
- **THEN** no error is propagated to the caller

### Requirement: Secondary query result limit

Each secondary query SHALL use a limit of 2 results. The primary query SHALL use `RECALL_LIMIT_FOR_CONTEXT` as its limit.

#### Scenario: Secondary queries request fewer results

- **WHEN** `getContext` issues secondary queries
- **THEN** each secondary query is issued with `limit: 2`
