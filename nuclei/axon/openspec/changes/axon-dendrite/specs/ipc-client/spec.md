## ADDED Requirements

### Requirement: Typed async methods for all cortex operations

`AxonClient` SHALL expose typed async methods for every request type in the cortex IPC protocol: `recall`, `getContext`, `getRecent`, `getStats`, `logInsight`, `insertMemory`, `importText`, `consolidate`. Each method SHALL accept the corresponding payload type from `@memex/cortex` and return a typed promise.

#### Scenario: Successful recall

- **WHEN** `axon.recall(query, options)` is called and cortex responds with results
- **THEN** the promise resolves with the typed result array

#### Scenario: Cortex returns an error response

- **WHEN** cortex responds with `{ ok: false, error: "..." }`
- **THEN** the promise rejects with an `Error` containing the error message

### Requirement: Request correlation by UUID

Each outgoing request SHALL be assigned a `randomUUID()` ID. The client SHALL match incoming response frames to pending requests by ID. Concurrent in-flight requests SHALL not interfere with each other.

#### Scenario: Concurrent requests

- **WHEN** two requests are sent before either response arrives
- **THEN** each resolves with its own correct response

### Requirement: Per-call timeout

Each method SHALL accept an optional `timeoutMs` parameter. If a response is not received within `timeoutMs`, the promise SHALL reject with a timeout error. The socket connection SHALL NOT be destroyed on timeout.

#### Scenario: Timeout exceeded

- **WHEN** cortex does not respond within `timeoutMs`
- **THEN** the promise rejects with a timeout error and subsequent calls on the same client still work

### Requirement: Persistent socket with reconnect

`AxonClient` SHALL maintain a persistent connection to the cortex socket. On connection loss, the client SHALL attempt reconnect with linear backoff (up to 3 attempts). Calls made during reconnect SHALL queue and resolve once reconnected or reject after max retries.

#### Scenario: Socket drops mid-session

- **WHEN** the cortex socket closes unexpectedly
- **THEN** the client reconnects automatically and subsequent calls succeed

#### Scenario: Max retries exceeded

- **WHEN** cortex is not available after 3 reconnect attempts
- **THEN** queued calls reject with a connection error

### Requirement: Explicit disconnect

`AxonClient` SHALL expose a `disconnect()` method that closes the socket and rejects all pending in-flight requests.

#### Scenario: Disconnect with pending requests

- **WHEN** `disconnect()` is called while requests are in flight
- **THEN** all in-flight promises reject immediately

### Requirement: Session ID required at construction

`AxonClient` SHALL be constructed with a `sessionId` string. The socket path SHALL be derived as `IPC_SOCKET_PATH(sessionId)` from `@memex/cortex`. An invalid session ID SHALL throw synchronously at construction.

#### Scenario: Invalid session ID

- **WHEN** `new AxonClient('../../etc/passwd')` is called
- **THEN** the constructor throws with an invalid session ID error
