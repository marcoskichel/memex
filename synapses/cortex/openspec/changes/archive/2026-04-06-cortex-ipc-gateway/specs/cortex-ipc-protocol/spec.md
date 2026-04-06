## ADDED Requirements

### Requirement: NDJSON framing

All messages over the socket SHALL be newline-delimited JSON — one JSON object per line, terminated by `\n`. Partial lines SHALL be buffered until a newline is received.

#### Scenario: Single-line message

- **WHEN** a client sends `{"id":"1","type":"getStats"}\n`
- **THEN** cortex parses it as one complete message

#### Scenario: Fragmented write

- **WHEN** a client sends a message in two TCP segments split mid-JSON
- **THEN** cortex buffers and parses correctly once the `\n` arrives

### Requirement: Request/response correlation

Request messages SHALL carry a string `id` field. Response messages SHALL echo the same `id` so clients can correlate responses to requests.

#### Scenario: Correlated response

- **WHEN** client sends `{"id":"abc","type":"recall","payload":{"query":"auth"}}`
- **THEN** cortex responds `{"id":"abc","ok":true,"result":[...]}`

### Requirement: Request types

The protocol SHALL support the following request types:

- `logInsight` — payload: `{ summary, contextFile, tags?, sessionId }` — response: `{ ok: true }`
- `getContext` — payload: `{ sessionId, toolName, toolInput }` — response: `{ ok: true, result: string }`
- `recall` — payload: `{ query, options? }` — response: `{ ok: true, result: LtmQueryResult[] }`
- `getStats` — no payload — response: `{ ok: true, result: MemoryStats }`

#### Scenario: Unknown request type

- **WHEN** client sends a message with an unrecognized `type`
- **THEN** cortex responds `{ id, ok: false, error: "unknown request type" }`

### Requirement: Error responses

If a request fails, cortex SHALL respond with `{ id, ok: false, error: string }` rather than closing the connection.

#### Scenario: Recall with LTM error

- **WHEN** a `recall` request fails internally
- **THEN** the client receives `{ id, ok: false, error: "<message>" }` and the connection remains open

### Requirement: Push messages for events

Cortex SHALL push event messages to all connected clients with no `id` field: `{ type: "event", name: <MemoryEventName>, payload: <event payload> }`.

#### Scenario: Amygdala cycle event broadcast

- **WHEN** the amygdala emits `amygdala:cycle:end`
- **THEN** all connected clients receive `{"type":"event","name":"amygdala:cycle:end","payload":{...}}\n`
