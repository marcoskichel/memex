## MODIFIED Requirements

### Requirement: System prompt instructs entity extraction with negative examples

The amygdala system prompt SHALL include instructions to extract named entities and SHALL list explicit negative examples: bare pronouns, abstract nouns, temporal expressions, and generic verbs MUST NOT be extracted as entities. The prompt SHALL additionally instruct the LLM to use the most complete known proper name for each entity, preferring full names over partial names or role aliases.

#### Scenario: Prompt suppresses generic noun extraction

- **WHEN** an observation contains only generic language ("the system processed the request")
- **THEN** `result.entities` is `[]`

#### Scenario: Prompt guides toward full canonical name

- **WHEN** an observation mentions "Alice" in a context where "Alice Smith" is the known full name
- **THEN** the extracted entity name is "alice smith" not "alice"
