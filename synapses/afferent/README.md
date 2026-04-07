# `@neurome/afferent`

Fire-and-forget event bridge that sends agent observations from an agent process to a running cortex instance over a Unix socket without blocking agent execution.

Part of the [Neurome](../../README.md) synapse layer.

## How it works

```
agent process
     |
     | emit(event)  [fire-and-forget, no await]
     v
  Afferent
     |-- connected? --> write to socket immediately
     |-- connecting? --> queue (up to 1000 events)
     |                   flush on connect
     v
/tmp/neurome-{sessionId}.sock
     |
     v
  cortex (IPC server)
```

Each emitted event is wrapped as a `logInsight` IPC frame and tagged automatically with `agent:{name}`, `run:{runId}`, and `observation`. The `runId` is a UUID generated once per `createAfferent` call and shared across all events in that run.

## Usage

```ts
import { createAfferent } from '@neurome/afferent';
import type { AgentEvent } from '@neurome/afferent';

// sessionId identifies the cortex instance to connect to
const afferent = createAfferent('my-session');

// emit is synchronous and non-blocking
const event: AgentEvent = { agent: 'my-agent', text: 'tool call completed' };
afferent.emit(event);

// call disconnect when the agent process is shutting down
afferent.disconnect();
```

## Related

- [`@neurome/cortex`](../cortex/README.md) — the cortex nucleus that receives these events
- [`@neurome/cortex-ipc`](../../nuclei/cortex-ipc/README.md) — IPC socket path constants shared between afferent and cortex
- [`@neurome/axon`](../axon/README.md) — use instead when you need a response back from cortex

## License

MIT
