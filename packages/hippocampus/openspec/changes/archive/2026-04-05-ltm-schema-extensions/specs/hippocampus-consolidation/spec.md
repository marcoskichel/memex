## MODIFIED Requirements

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
