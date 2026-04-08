## ADDED Requirements

### Requirement: log_insight MCP tool

The dendrite server SHALL register a `log_insight` MCP tool when access mode is `'full'`.

#### Scenario: Tool registered in full mode

- **WHEN** dendrite starts with `NEUROME_ACCESS_MODE=full`
- **THEN** the `log_insight` tool is available in the MCP server

#### Scenario: Tool not registered in read-only mode

- **WHEN** dendrite starts with `NEUROME_ACCESS_MODE=read-only` or no env var
- **THEN** the `log_insight` tool is NOT registered

### Requirement: log_insight accepts a single string input

The `log_insight` tool SHALL accept exactly one input field: `insight` of type string with a maximum length of 10,000 characters.

#### Scenario: Valid input

- **WHEN** an MCP client calls `log_insight` with `{ "insight": "I know nothing!" }`
- **THEN** `axon.logInsight` is called with `{ summary: "I know nothing!", contextFile: "" }`

#### Scenario: Input exceeds max length

- **WHEN** an MCP client calls `log_insight` with an `insight` string longer than 10,000 characters
- **THEN** the tool returns a validation error without calling `axon.logInsight`

### Requirement: log_insight returns immediately

The `log_insight` tool SHALL return `{ logged: true }` without waiting for processing.

#### Scenario: Immediate response

- **WHEN** `log_insight` is called
- **THEN** the tool returns `{ logged: true }` immediately (fire-and-forget)
