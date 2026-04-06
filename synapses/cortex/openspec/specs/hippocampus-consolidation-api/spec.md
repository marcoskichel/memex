## consolidate-ipc

`RequestMessage` SHALL include `{ type: 'consolidate'; payload: Record<never, never> }`.

The IPC handler SHALL dispatch `consolidate` requests to `memory.consolidate()`.
