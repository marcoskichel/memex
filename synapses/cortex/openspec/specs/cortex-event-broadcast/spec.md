# cortex-event-broadcast Specification

## Purpose

Defines how cortex broadcasts memory events to connected socket clients, forwarding all MemoryEvents to clients in real-time.

## Requirements

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

### Requirement: Disconnected clients removed from broadcast set

When a client socket closes or errors, it SHALL be removed from the broadcast set immediately.

#### Scenario: Client disconnects mid-session

- **WHEN** a client disconnects (socket close or error)
- **THEN** subsequent events are not written to that socket and no write errors occur
