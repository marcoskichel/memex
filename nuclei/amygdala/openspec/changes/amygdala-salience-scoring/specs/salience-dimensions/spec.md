## ADDED Requirements

### Requirement: AmygdalaScoringResult includes three salience dimension fields

`AmygdalaScoringResult` SHALL include three optional numeric fields: `surprise`, `selfRelevance`, and `emotionalValence`, each in the range [0.0, 1.0]. These fields MAY be absent when the LLM does not return them; the `parse()` function MUST default each to `undefined` rather than throwing.

#### Scenario: All three dimensions returned by LLM

- **WHEN** the LLM returns `{ surprise: 0.8, selfRelevance: 0.6, emotionalValence: 0.3, importanceScore: 0.7, action: "insert", ... }`
- **THEN** `parse()` returns a result with `surprise === 0.8`, `selfRelevance === 0.6`, `emotionalValence === 0.3`

#### Scenario: Dimensions clamped to valid range

- **WHEN** the LLM returns a dimension value outside [0, 1] (e.g. `surprise: 1.5`)
- **THEN** `parse()` clamps it to `1.0`

#### Scenario: Missing dimension defaults to undefined

- **WHEN** the LLM omits `selfRelevance` from its response
- **THEN** `parse()` returns `selfRelevance === undefined` without throwing

### Requirement: Scoring schema exposes dimension fields to LLM

`amygdalaScoringSchema.shape` SHALL declare `surprise`, `selfRelevance`, and `emotionalValence` as optional number fields so the LLM structured output can include them.

#### Scenario: Schema accepts dimension fields in LLM output

- **WHEN** the structured output includes all three dimension fields alongside `action` and `importanceScore`
- **THEN** `parse()` extracts them without error

### Requirement: System prompt elicits explicit dimension reasoning

The amygdala system prompt SHALL instruct the LLM to assess `surprise`, `selfRelevance`, and `emotionalValence` explicitly, providing a brief definition of each, before producing `importanceScore`. The prompt SHALL make clear that `importanceScore` should reflect the combined signal of all three dimensions.

#### Scenario: Low-salience observation scores low on all dimensions

- **WHEN** an observation describes a routine, expected, non-self-referential action with no emotional charge
- **THEN** all three dimension scores are below 0.3 and `importanceScore` is below 0.4

#### Scenario: Reflective observation scores high on self-relevance

- **WHEN** an observation describes a behavioral pattern or preference of the agent (e.g. "I tend to avoid premature abstractions")
- **THEN** `selfRelevance` is above 0.6 and `importanceScore` is above 0.5

#### Scenario: Unexpected failure scores high on surprise

- **WHEN** an observation describes an unexpected error or surprising outcome
- **THEN** `surprise` is above 0.6 and `importanceScore` is above 0.5

### Requirement: agentState hints reference salience dimensions

Each built-in `agentState` hint SHALL name the dimension it weights:

- `stressed`: weight `emotionalValence` more heavily
- `learning`: weight `surprise` more heavily
- `focused`: raise bar for low-`selfRelevance`, low-`surprise` observations
- `idle`: assess all dimensions normally

#### Scenario: Stressed state elevates emotionally valenced observation

- **WHEN** `agentState === "stressed"` and an observation has high `emotionalValence`
- **THEN** the system prompt hints direct the LLM to score it more highly than in idle state

#### Scenario: Learning state elevates surprising observation

- **WHEN** `agentState === "learning"` and an observation describes an unexpected discovery
- **THEN** the system prompt hints direct the LLM to weight surprise more heavily
