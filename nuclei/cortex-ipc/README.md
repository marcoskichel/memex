# `@neurome/cortex-ipc`

The synaptic protocol — shared message types and socket-path convention for communicating with a running cortex server over a Unix domain socket.

Part of the [Neurome](../../README.md) memory infrastructure.

> **Most users should use [`@neurome/axon`](../axon) instead.** This package is the low-level shared contract. Use it only when implementing a new client or server in any language.

## Usage

Resolve the socket path for a session, then speak plain JSON over the Unix socket.

```ts
import { IPC_SOCKET_PATH } from '@neurome/cortex-ipc';

const socketPath = IPC_SOCKET_PATH('my-session-1');
// => /tmp/neurome-my-session-1.sock
```

Wire protocol — one JSON object per line (JSON-NL):

```json
// request
{"id":"req-1","type":"recall","payload":{"query":"project goals"}}

// success response
{"id":"req-1","ok":true,"result":[...]}

// error response
{"id":"req-1","ok":false,"error":"no results found"}

// server-push event (unsolicited)
{"type":"event","name":"memory:inserted","payload":{...}}
```

## API

| Export                       | Description                                                                                                                                                                                   |
| ---------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `IPC_SOCKET_PATH(sessionId)` | Returns `/tmp/neurome-{sessionId}.sock`. Throws if `sessionId` is invalid.                                                                                                                    |
| `RequestMessage`             | Discriminated union of all 8 request types (`logInsight`, `getContext`, `recall`, `getStats`, `insertMemory`, `importText`, `getRecent`, `consolidate`), each shaped `{ id, type, payload }`. |
| `ResponseMessage`            | `{ id, ok: true, result }` on success or `{ id, ok: false, error }` on failure.                                                                                                               |
| `PushMessage`                | Unsolicited server event: `{ type: 'event', name: MemoryEventName, payload }`.                                                                                                                |
| `REQUEST_TYPES`              | Readonly array of all valid request type strings.                                                                                                                                             |

Full API reference → <!-- link to docs -->

## Related

- [`@neurome/axon`](../axon) — high-level IPC client; use this instead of talking the wire protocol directly
- [`@neurome/cortex`](../../synapses/cortex) — the cortex server that listens on the socket

## License

MIT
