## MODIFIED Requirements

### Requirement: All MemoryEvents forwarded to connected clients

Cortex SHALL register listeners for every event name in `MemoryEvents` — including `perirhinal:extraction:end` — and broadcast each to all currently connected socket clients.

#### Scenario: Event with one client connected

- **WHEN** amygdala emits `amygdala:entry:scored` and one client is connected
- **THEN** that client receives the event push message within one event loop tick

#### Scenario: Event with no clients connected

- **WHEN** an event is emitted and no clients are connected
- **THEN** the event is silently dropped (no error, no buffering)

#### Scenario: Event with multiple clients connected

- **WHEN** an event is emitted and three clients are connected
- **THEN** all three receive the push message

#### Scenario: perirhinal:extraction:end is broadcast to connected clients

- **WHEN** `memory` emits `perirhinal:extraction:end` after an entity extraction run
- **THEN** all connected cortex clients receive the event push message
