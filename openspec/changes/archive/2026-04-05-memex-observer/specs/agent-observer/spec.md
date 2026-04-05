## ADDED Requirements

### Requirement: Observer creation

The package SHALL export a `createMemexObserver(sessionId: string)` function that returns a `(event: AgentEvent) => void` callback. The function SHALL open a Unix socket connection to the cortex IPC server for the given `sessionId` immediately upon invocation.

#### Scenario: Observer created with valid session

- **WHEN** `createMemexObserver('qa-explorer-send-flow')` is called
- **THEN** a persistent socket connection attempt is initiated to `IPC_SOCKET_PATH('qa-explorer-send-flow')`
- **THEN** a callable observer function is returned immediately (before the socket connects)

### Requirement: Event buffering before connect

The observer SHALL buffer all events received before the socket connection is established and flush them in order once the socket connects.

#### Scenario: Events fired before socket connects

- **WHEN** the observer function is called before the `connect` event fires on the socket
- **THEN** the event frame is appended to an internal queue
- **WHEN** the socket emits `connect`
- **THEN** all queued frames are written to the socket in order and the queue is cleared

### Requirement: Event translation to logInsight

The observer SHALL translate each known `AgentEvent` type into a `logInsight` IPC request with a human-readable `summary` and relevant `tags`.

#### Scenario: STAGE_START event

- **WHEN** the observer receives `{ type: 'STAGE_START', agent: 'explorer' }`
- **THEN** a `logInsight` frame is written with summary containing the agent name and tags including `agent:explorer` and `lifecycle`

#### Scenario: STAGE_END event

- **WHEN** the observer receives `{ type: 'STAGE_END', agent: 'explorer', durationMs: 45000 }`
- **THEN** a `logInsight` frame is written with summary containing the agent name and duration, and tags including `lifecycle`

#### Scenario: THOUGHT event

- **WHEN** the observer receives `{ type: 'THOUGHT', agent: 'explorer', text: 'I can see the home screen...' }`
- **THEN** a `logInsight` frame is written with summary containing the thought text and tags including `observation`

#### Scenario: TOOL_CALL event

- **WHEN** the observer receives `{ type: 'TOOL_CALL', agent: 'explorer', toolName: 'tap', input: { element: 'Send' } }`
- **THEN** a `logInsight` frame is written with summary containing the tool name and serialised input, and tags including `navigation` and `tool:tap`

#### Scenario: TOOL_RESULT event

- **WHEN** the observer receives `{ type: 'TOOL_RESULT', agent: 'explorer', toolName: 'accessibility_snapshot', result: '<large tree>' }`
- **THEN** a `logInsight` frame is written with summary containing the tool name and result truncated to 500 characters, and tags including `screen-state` and `tool:accessibility_snapshot`

#### Scenario: Unknown event type

- **WHEN** the observer receives an event with an unrecognised `type`
- **THEN** a `logInsight` frame is written with a generic summary and no extra tags beyond `agent:<name>` and `run:<runId>`

### Requirement: Per-run identifier

The observer SHALL generate a unique `runId` (UUID) on creation and include it as a `run:<runId>` tag on every emitted insight, enabling grouping of all observations from a single agent run.

#### Scenario: All events share the same runId

- **WHEN** an observer is created and receives multiple events
- **THEN** all emitted `logInsight` frames include the same `run:<runId>` tag

### Requirement: Silent degradation when cortex unavailable

The observer SHALL not throw or propagate errors if the cortex IPC server is not running. The consuming agent process MUST continue normally.

#### Scenario: Cortex not running

- **WHEN** `createMemexObserver` is called and no cortex process is listening on the socket path
- **THEN** the socket emits an error
- **THEN** the error is silently swallowed
- **THEN** subsequent calls to the observer function do not throw
