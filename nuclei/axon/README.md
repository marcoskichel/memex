# `@neurome/axon`

Axon is the signal carrier — an IPC client that connects to a running cortex server over a Unix domain socket and exposes all memory operations as async methods.

Part of the [Neurome](../../README.md) memory infrastructure.

## Usage

```ts
import { AxonClient } from '@neurome/axon';

const client = new AxonClient('my-session-id');
// connects to /tmp/neurome-my-session-id.sock

// fire-and-forget: does not block
client.logInsight({ content: 'User prefers TypeScript over JavaScript' });

// search long-term memory
const results = await client.recall('TypeScript preferences');
// => [{ record: { id: 1, tier: 'ltm', data: '...', metadata: {} }, effectiveScore: 0.91 }]

// retrieve recent memory records
const recent = await client.getRecent(5);
// => [{ id: 2, tier: 'stm', data: '...', metadata: {} }, ...]

// pre-assembled context string ready for an LLM prompt
const context = await client.getContext({ query: 'TypeScript preferences' });
// => 'User prefers TypeScript over JavaScript...'

client.disconnect();
```

## API

| Export                                       | Description                                                     |
| -------------------------------------------- | --------------------------------------------------------------- |
| `AxonClient`                                 | Main IPC client class                                           |
| `AxonClient.constructor(sessionId)`          | Derives socket path `/tmp/neurome-{sessionId}.sock`             |
| `AxonClient.recall(query, params?)`          | Search memory; default timeout 200ms                            |
| `AxonClient.getContext(payload, timeoutMs?)` | Returns pre-assembled context string                            |
| `AxonClient.getRecent(limit, timeoutMs?)`    | Returns most recent `LtmRecord[]` entries                       |
| `AxonClient.getStats(timeoutMs?)`            | Returns memory statistics object                                |
| `AxonClient.logInsight(payload)`             | Fire-and-forget write; does not return a Promise                |
| `AxonClient.insertMemory(data, options?)`    | Inserts a memory record; returns its id                         |
| `AxonClient.importText(text, timeoutMs?)`    | Bulk-inserts text; returns `{ inserted: number }`               |
| `AxonClient.consolidate(timeoutMs?)`         | Triggers memory consolidation                                   |
| `AxonClient.disconnect()`                    | Rejects in-flight requests and closes the socket                |
| `RecallResult`                               | Type for a single recall hit with `record` and `effectiveScore` |
| `RecallParams`                               | Options type for `recall` (`options`, `timeoutMs`)              |
| `MemoryStats`                                | Type alias for the stats payload (`Record<string, unknown>`)    |

**Behavior notes:**

- Default timeout is 200ms for all methods except `logInsight`.
- Requests sent before the connection is established are queued and flushed once connected.
- On socket disconnect, reconnects up to 3 times with delays of 100ms, 200ms, 300ms.

Full API reference → <!-- link to docs -->

## Related

- [`@neurome/cortex`](../cortex/README.md) — the in-process memory engine axon talks to
- [`@neurome/cortex-ipc`](../cortex-ipc/README.md) — shared IPC message types and socket path convention
- [`@neurome/dendrite`](../dendrite/README.md) — MCP server that exposes memory tools to LLM agents

## License

MIT
