## ADDED Requirements

### Requirement: AmygdalaConfig accepts optional agentProfile

`AmygdalaConfig` SHALL accept an optional `agentProfile?: { type?: string; purpose?: string }` field. When absent, behavior SHALL be identical to today.

#### Scenario: AmygdalaConfig with agentProfile

- **WHEN** amygdala is constructed with `{ agentProfile: { type: 'qa', purpose: 'Find UI bugs in Exodus mobile app' }, ... }`
- **THEN** it starts without error and the profile is available to the scoring prompt builder

#### Scenario: AmygdalaConfig without agentProfile

- **WHEN** amygdala is constructed without `agentProfile`
- **THEN** it starts without error and scoring behavior is identical to the current implementation

### Requirement: Scoring system prompt includes agent profile context before importance instructions

When `agentProfile` is provided, the LLM scoring system prompt SHALL include the agent's type and purpose as context BEFORE the importance scoring instructions. The prompt MUST include explicit guidance to populate `goalRelevance`: observations that directly advance or reveal blockers to the agent's stated purpose deserve higher scores, even if syntactically simple. The `purpose` field SHALL be truncated to 200 characters before injection.

#### Scenario: Navigation event scores high with matching purpose

- **WHEN** `agentProfile.purpose = 'Explore a mobile app UI to identify bugs'` and the insight is `'Navigated from screen A to screen B via tap on Settings'`
- **THEN** `importanceScore >= 0.5` (structural navigation knowledge is high-value for this purpose)
- **AND** `goalRelevance >= 0.6` (navigation directly advances UI exploration goal)

#### Scenario: Same event scores low without agentProfile

- **WHEN** the same insight `'Navigated from screen A to screen B via tap on Settings'` is scored without `agentProfile`
- **THEN** `importanceScore <= 0.3` (syntactically thin, low semantic density in isolation)
- **AND** `goalRelevance` is absent from the result

#### Scenario: Profile type is included when present

- **WHEN** `agentProfile.type = 'qa'` is set
- **THEN** the system prompt includes the type string as additional context alongside purpose

#### Scenario: Partial profile with only purpose

- **WHEN** `agentProfile = { purpose: 'Debug authentication flow' }` (no type)
- **THEN** the system prompt includes the purpose and scoring proceeds normally

#### Scenario: Partial profile with only type

- **WHEN** `agentProfile = { type: 'coding' }` (no purpose)
- **THEN** the system prompt includes the type and scoring proceeds normally

#### Scenario: Purpose is truncated at 200 characters

- **WHEN** `agentProfile.purpose` is longer than 200 characters
- **THEN** only the first 200 characters are injected into the system prompt

### Requirement: AmygdalaScoringResult includes goalRelevance dimension when agentProfile is set

When `agentProfile` is provided, the LLM scoring prompt SHALL instruct the LLM to populate `goalRelevance?: number` (0–1) in `AmygdalaScoringResult`. This dimension captures whether the observation directly advances or reveals blockers to the agent's stated purpose. When `agentProfile` is absent, `goalRelevance` SHALL be absent from the result.

#### Scenario: goalRelevance populated with matching purpose

- **WHEN** amygdala scores `'Login button click succeeded, user redirected to dashboard'` with `agentProfile = { purpose: 'Verify login functionality' }`
- **THEN** `AmygdalaScoringResult` includes `goalRelevance >= 0.8`

#### Scenario: goalRelevance low with mismatched purpose

- **WHEN** the same insight is scored with `agentProfile = { purpose: 'Measure animation performance' }`
- **THEN** `AmygdalaScoringResult` includes `goalRelevance <= 0.2`

#### Scenario: goalRelevance absent without agentProfile

- **WHEN** amygdala scores an insight without `agentProfile` set
- **THEN** `AmygdalaScoringResult` does not include a `goalRelevance` field
