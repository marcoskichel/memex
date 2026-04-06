## ADDED Requirements

### Requirement: Session configured via MEMEX_SESSION_ID

`dendrite` SHALL read `MEMEX_SESSION_ID` from the environment at startup. If the variable is not set, the process SHALL exit with a non-zero code and a clear error message. The session ID SHALL be used to construct an `AxonClient` that all tool calls share.

#### Scenario: MEMEX_SESSION_ID not set

- **WHEN** `dendrite` starts without `MEMEX_SESSION_ID` in the environment
- **THEN** the process exits with a non-zero code and prints an error naming the missing variable

#### Scenario: Valid session ID provided

- **WHEN** `MEMEX_SESSION_ID` is set to a valid session ID
- **THEN** the MCP server starts and accepts tool calls

### Requirement: recall tool

`dendrite` SHALL expose a `recall` MCP tool accepting `{ query: string, options?: object }`. It SHALL delegate to `axon.recall(query, options)` and return the result array.

#### Scenario: Successful recall

- **WHEN** an MCP client calls `recall` with a natural language query
- **THEN** the tool returns matching memory records with scores

#### Scenario: Cortex unavailable

- **WHEN** the cortex socket is not reachable
- **THEN** the tool returns an MCP error response; the server process stays alive

### Requirement: get_context tool

`dendrite` SHALL expose a `get_context` MCP tool accepting `{ tool_name: string, tool_input: unknown, category?: string }`. It SHALL delegate to `axon.getContext(payload)` using the server's session ID and return the assembled context string.

#### Scenario: Successful context retrieval

- **WHEN** an MCP client calls `get_context` with a tool name and input
- **THEN** the tool returns the assembled context string from cortex

### Requirement: get_recent tool

`dendrite` SHALL expose a `get_recent` MCP tool accepting `{ limit: number }`. It SHALL delegate to `axon.getRecent(limit)` and return the records array.

#### Scenario: Successful recent retrieval

- **WHEN** an MCP client calls `get_recent` with limit 10
- **THEN** the tool returns up to 10 most recent LTM records

### Requirement: get_stats tool

`dendrite` SHALL expose a `get_stats` MCP tool accepting no input. It SHALL delegate to `axon.getStats()` and return the stats object.

#### Scenario: Successful stats retrieval

- **WHEN** an MCP client calls `get_stats`
- **THEN** the tool returns the current memory system stats

### Requirement: Write operations excluded

`dendrite` SHALL NOT expose `logInsight`, `insertMemory`, `importText`, or `consolidate` as MCP tools.

#### Scenario: No write tools registered

- **WHEN** an MCP client lists available tools
- **THEN** only `recall`, `get_context`, `get_recent`, `get_stats` appear
