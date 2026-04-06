## MODIFIED Requirements

### Requirement: AgentEvent streamed as logInsight via axon

`afferent` SHALL translate `AgentEvent` values into `logInsight` payloads and deliver them via `@memex/axon` in fire-and-forget mode. The `AgentEvent` taxonomy, `summaryFor`, `extraTagsFor`, and tag structure are unchanged. The public API (`createAfferent`, `emit`, `disconnect`) is unchanged.

#### Scenario: Event emitted before socket connects

- **WHEN** `emit(event)` is called before the axon client has connected
- **THEN** the event is queued and delivered once the connection is established

#### Scenario: Event emitted after connected

- **WHEN** `emit(event)` is called on a connected afferent instance
- **THEN** the logInsight frame is sent immediately via axon without awaiting a response

#### Scenario: Queue does not exceed limit

- **WHEN** more than 1000 events are emitted before a connection is established
- **THEN** events beyond the limit are dropped silently

#### Scenario: Disconnect closes axon

- **WHEN** `disconnect()` is called
- **THEN** the axon client is disconnected and the pre-connect queue is cleared
