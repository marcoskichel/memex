## ADDED Requirements

### Requirement: Entity names are normalized to lowercase at extraction time

After the LLM returns entity mentions, `parseEntities` SHALL lowercase every `name` value before returning. No entity name with uppercase characters SHALL ever be written to LTM metadata.

#### Scenario: Uppercase entity name is lowercased

- **WHEN** the LLM returns `{ name: 'Alice Smith', type: 'person' }`
- **THEN** `parseEntities` returns `{ name: 'alice smith', type: 'person' }`

#### Scenario: Mixed-case tool name is lowercased

- **WHEN** the LLM returns `{ name: 'TypeScript', type: 'tool' }`
- **THEN** `parseEntities` returns `{ name: 'typescript', type: 'tool' }`

#### Scenario: Already-lowercase names are unchanged

- **WHEN** the LLM returns `{ name: 'sqlite', type: 'tool' }`
- **THEN** `parseEntities` returns `{ name: 'sqlite', type: 'tool' }`

### Requirement: System prompt instructs LLM to use canonical entity names

The amygdala system prompt SHALL instruct the LLM to prefer the most complete known proper name for an entity. Role-based or alias names (e.g., "the CEO", "the user") SHALL only be used when no proper name is known.

#### Scenario: Full name preferred over partial name

- **WHEN** an observation refers to someone whose full name is known from context
- **THEN** the extracted entity uses the full name (e.g., "alice smith") not a partial form (e.g., "alice")

#### Scenario: Role-based name used only when proper name is unavailable

- **WHEN** an observation refers to "the tech lead" with no other identifying information
- **THEN** the extracted entity name is "the tech lead" (acceptable fallback)
