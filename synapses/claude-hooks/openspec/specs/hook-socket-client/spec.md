## MODIFIED Requirements

### Requirement: Socket path derived from session ID

The hook SHALL derive the session ID from `MEMORY_SESSION_ID` env var, falling back to `payload.session_id`. The socket path SHALL be constructed via `@memex/axon` using `AxonClient(sessionId)`. If neither source provides a session ID, the hook SHALL skip the connection and exit 0.

#### Scenario: Session ID from env var

- **WHEN** `MEMORY_SESSION_ID` is set
- **THEN** axon connects to `/tmp/memex-<MEMORY_SESSION_ID>.sock`

#### Scenario: No session ID available

- **WHEN** neither `MEMORY_SESSION_ID` nor `payload.session_id` is available
- **THEN** the hook skips the connection and exits 0

### Requirement: 50ms hard timeout for logInsight

The `post-tool-use` hook SHALL call `axon.logInsight(payload, { timeoutMs: 50 })`. If the call does not complete within 50ms, the hook SHALL exit 0 without error.

#### Scenario: Cortex not running

- **WHEN** no socket exists at the expected path
- **THEN** the axon call times out within 50ms and the hook exits 0

### Requirement: 200ms timeout for getContext

The `pre-tool-use` hook SHALL call `axon.getContext(payload, { timeoutMs: 200 })`. If the call does not complete within 200ms, the hook SHALL exit 0 with empty output.

#### Scenario: Cortex under load

- **WHEN** cortex takes longer than 200ms to respond
- **THEN** the hook exits 0 with empty output

### Requirement: Exit 0 on any failure

All axon call errors (timeout, connection refused, parse error) SHALL be caught. The hook SHALL always exit 0 regardless of error type.

#### Scenario: Axon throws on write

- **WHEN** the axon client encounters any error during a call
- **THEN** the hook catches the error and exits 0
