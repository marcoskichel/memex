## MODIFIED Requirements

### Requirement: System prompt instructs entity extraction with negative examples

The amygdala system prompt SHALL include instructions to extract named entities and SHALL list explicit negative examples: bare pronouns, abstract nouns, temporal expressions, and generic verbs MUST NOT be extracted as entities. The prompt SHALL additionally instruct the LLM to use the most complete known proper name for each entity, preferring full names over partial names or role aliases.

The prompt SHALL also instruct the LLM to assess three salience dimensions — `surprise`, `selfRelevance`, and `emotionalValence` — before producing `importanceScore`. Each dimension MUST be defined in the prompt. The prompt SHALL state that `importanceScore` should reflect the combined signal of all three dimensions.

#### Scenario: Prompt suppresses generic noun extraction

- **WHEN** an observation contains only generic language ("the system processed the request")
- **THEN** `result.entities` is `[]`

#### Scenario: Prompt guides toward full canonical name

- **WHEN** an observation mentions "Alice" in a context where "Alice Smith" is the known full name
- **THEN** the extracted entity name is "alice smith" not "alice"

#### Scenario: Prompt includes dimension definitions

- **WHEN** `buildSystemPrompt()` is called (with or without agentState)
- **THEN** the returned string contains the words "surprise", "self-relevance", and "emotional valence" (or equivalent labels)
