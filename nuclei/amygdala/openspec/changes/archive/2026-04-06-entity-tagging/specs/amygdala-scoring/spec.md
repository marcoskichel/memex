## MODIFIED Requirements

### Requirement: AmygdalaScoringResult includes entity mentions

The `AmygdalaScoringResult` interface SHALL include an `entities: EntityMention[]` field. The field MUST always be present; it SHALL default to `[]` when no entities are extractable.

#### Scenario: Scoring result includes extracted entities

- **WHEN** the LLM scores an observation containing "Marcos prefers TypeScript"
- **THEN** `result.entities` contains at least one entry with `{ name: 'Marcos', type: 'person' }` and one with `{ name: 'TypeScript', type: 'tool' }`

#### Scenario: Scoring result defaults to empty entities on skip

- **WHEN** the LLM classifies an observation as `skip`
- **THEN** `result.entities` is `[]` and the record is not written to LTM

#### Scenario: Malformed entities field defaults to empty array

- **WHEN** the LLM returns a malformed or missing `entities` field
- **THEN** `amygdalaScoringSchema.parse` returns `entities: []` without throwing

### Requirement: System prompt instructs entity extraction with negative examples

The amygdala system prompt SHALL include instructions to extract named entities and SHALL list explicit negative examples: bare pronouns, abstract nouns, temporal expressions, and generic verbs MUST NOT be extracted as entities.

#### Scenario: Prompt suppresses generic noun extraction

- **WHEN** an observation contains only generic language ("the system processed the request")
- **THEN** `result.entities` is `[]`
