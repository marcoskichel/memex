## ADDED Requirements

### Requirement: Persistent connection with auto-reconnect

The TUI socket client SHALL maintain a persistent connection and attempt reconnection on disconnect using a 2-second backoff, up to 10 attempts.

#### Scenario: Cortex restarts mid-session

- **WHEN** the socket closes and cortex restarts within 20 seconds
- **THEN** the TUI reconnects automatically without requiring a TUI restart

#### Scenario: Reconnect limit exceeded

- **WHEN** 10 reconnect attempts all fail
- **THEN** the TUI displays a "connection lost — restart cortex" message and stops retrying

### Requirement: Event push subscription

The client SHALL receive all push messages (`type: "event"`) from cortex and surface them to the event feed component via a callback/emitter.

#### Scenario: Event received

- **WHEN** cortex broadcasts `amygdala:cycle:end`
- **THEN** the event feed component receives it within one render cycle

### Requirement: Typed request/response

The client SHALL provide typed async methods for each request type: `recall(query, options?)`, `getStats()`. Each returns a Promise that rejects if the response has `ok: false` or times out after 5 seconds.

#### Scenario: Successful recall

- **WHEN** `recall("auth system")` is called
- **THEN** the Promise resolves with `LtmQueryResult[]`

#### Scenario: Cortex returns error

- **WHEN** cortex responds with `{ ok: false, error: "..." }`
- **THEN** the Promise rejects with the error message
