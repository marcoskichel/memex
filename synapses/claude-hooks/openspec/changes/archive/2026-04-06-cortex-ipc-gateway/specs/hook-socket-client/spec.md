## ADDED Requirements

### Requirement: Socket path derived from session ID

The client SHALL derive the socket path as `/tmp/memex-<sessionId>.sock` using `MEMORY_SESSION_ID` env var, falling back to `payload.session_id`. If neither is available, the client SHALL skip the connection and exit 0.

#### Scenario: Session ID from env var

- **WHEN** `MEMORY_SESSION_ID` is set
- **THEN** the client connects to `/tmp/memex-<MEMORY_SESSION_ID>.sock`

#### Scenario: No session ID available

- **WHEN** neither `MEMORY_SESSION_ID` nor `payload.session_id` is available
- **THEN** the client skips the connection and the hook exits 0

### Requirement: 50ms hard connect timeout for logInsight

The `post-tool-use` client SHALL attempt connection with a 50ms timeout. If the connect does not succeed within 50ms, the hook SHALL exit 0 without sending the message.

#### Scenario: Cortex not running

- **WHEN** no socket exists at the expected path
- **THEN** the connect fails within 50ms and the hook exits 0

### Requirement: 200ms timeout for getContext

The `pre-tool-use` client SHALL use a 200ms timeout for the full round-trip (connect + send + receive response).

#### Scenario: Cortex under load

- **WHEN** cortex takes longer than 200ms to respond to `getContext`
- **THEN** the hook exits 0 with empty output (Claude receives no injected context)

### Requirement: Exit 0 on any failure

The socket client SHALL never cause the hook to exit with a non-zero code. All errors (connect failure, write error, parse error, timeout) SHALL be caught and result in exit 0.

#### Scenario: Socket write error mid-send

- **WHEN** the socket closes unexpectedly while writing the request
- **THEN** the hook catches the error and exits 0
