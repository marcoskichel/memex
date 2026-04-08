### Requirement: McpAccessMode type

The SDK SHALL export a `McpAccessMode` type with values `'read-only'` and `'full'`.

#### Scenario: Type is exported

- **WHEN** a consumer imports from the SDK
- **THEN** `McpAccessMode` is available as a type export

### Requirement: McpServerOptions interface

The SDK SHALL export a `McpServerOptions` interface with an optional `accessMode` field of type `McpAccessMode`.

#### Scenario: No options provided

- **WHEN** `asMcpServer()` is called with no arguments
- **THEN** the resulting config defaults to `'read-only'` access mode

#### Scenario: Full access mode specified

- **WHEN** `asMcpServer({ accessMode: 'full' })` is called
- **THEN** the resulting config includes `NEUROME_ACCESS_MODE=full` in its env

### Requirement: asMcpServer propagates access mode via env var

`asMcpServer()` SHALL include `NEUROME_ACCESS_MODE` in the returned config's `env` record, set to the resolved access mode value.

#### Scenario: Default access mode

- **WHEN** `asMcpServer()` is called without options
- **THEN** `env.NEUROME_ACCESS_MODE` equals `'read-only'`

#### Scenario: Explicit read-only

- **WHEN** `asMcpServer({ accessMode: 'read-only' })` is called
- **THEN** `env.NEUROME_ACCESS_MODE` equals `'read-only'`

#### Scenario: Explicit full

- **WHEN** `asMcpServer({ accessMode: 'full' })` is called
- **THEN** `env.NEUROME_ACCESS_MODE` equals `'full'`
