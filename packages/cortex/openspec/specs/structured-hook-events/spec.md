## ADDED Requirements

### Requirement: Tool call summary format

When the cortex pre-tool-use hook intercepts a tool call, the resulting `logInsight` payload SHALL have a `summary` of the form:

```
Tool called: <toolName> — <serialized input truncated to 500 chars>
```

#### Scenario: Read tool call produces structured summary

- **WHEN** the hook intercepts `{ toolName: "Read", input: { file_path: "/tmp/foo.ts" } }`
- **THEN** `logInsight` is called with `summary: 'Tool called: Read — {"file_path":"/tmp/foo.ts"}'`

#### Scenario: Long input is truncated

- **WHEN** the serialized input JSON exceeds 500 characters
- **THEN** the summary contains the input truncated to exactly 500 characters

### Requirement: Semantic tags on hook-logged insights

Every `logInsight` payload emitted by the cortex hook SHALL include the following tags:

- `tool:<toolName>` — identifies which tool was called
- `navigation` — marks the insight as a tool-call / navigation event
- `agent:<agentName>` — identifies the originating agent (default: `claude`)
- `run:<sessionId>` — groups all insights from the same cortex session

#### Scenario: Tags present on every hook insight

- **WHEN** the hook intercepts any tool call during a session with `sessionId: "abc-123"`
- **THEN** the `logInsight` payload `tags` array includes `navigation`, `tool:<toolName>`, `agent:claude`, and `run:abc-123`

#### Scenario: Tool-specific tag reflects actual tool name

- **WHEN** the hook intercepts a `Bash` tool call
- **THEN** the tags array includes `tool:Bash`

### Requirement: Session-stable run identifier

The `run:<sessionId>` tag SHALL be identical for every insight logged within a single cortex session and SHALL NOT change between tool calls.

#### Scenario: All insights in a session share the same run tag

- **WHEN** the hook intercepts multiple tool calls during the same session
- **THEN** all resulting `logInsight` payloads include the same `run:<sessionId>` tag

### Requirement: Configurable agent name

The cortex hook SHALL use an agent name that is configurable via `CortexConfig`. When not configured, it SHALL default to `"claude"`.

#### Scenario: Default agent name

- **WHEN** `CortexConfig` does not include an `agentName` field
- **THEN** insights are tagged with `agent:claude`

#### Scenario: Custom agent name

- **WHEN** `CortexConfig` includes `agentName: "my-agent"`
- **THEN** insights are tagged with `agent:my-agent`
