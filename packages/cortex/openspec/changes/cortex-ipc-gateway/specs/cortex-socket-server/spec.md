## ADDED Requirements

### Requirement: Socket created on startup

Cortex SHALL create a Unix domain socket at `/tmp/memex-<sessionId>.sock` after the Memory instance is ready and before writing "cortex ready" to stderr.

#### Scenario: Normal startup

- **WHEN** cortex starts with a valid config
- **THEN** the socket file exists at `/tmp/memex-<sessionId>.sock` within 1 second

#### Scenario: Stale socket from prior crash

- **WHEN** a socket file already exists at the expected path and a connect attempt to it fails immediately
- **THEN** cortex removes the stale file and creates a new socket

### Requirement: Concurrent client connections accepted

The socket server SHALL accept multiple concurrent client connections without blocking or dropping messages.

#### Scenario: Hook and TUI connected simultaneously

- **WHEN** two clients connect concurrently (e.g., a hook and the TUI)
- **THEN** both receive responses to their requests independently

### Requirement: Socket removed on shutdown

Cortex SHALL remove the socket file when it shuts down cleanly or via SIGTERM/SIGINT.

#### Scenario: Graceful shutdown

- **WHEN** cortex receives SIGTERM
- **THEN** the socket file is removed before the process exits

#### Scenario: Hard crash

- **WHEN** cortex exits unexpectedly without cleanup
- **THEN** the stale socket is detected and removed on next cortex startup
