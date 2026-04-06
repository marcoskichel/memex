## 1. Package Setup

- [x] 1.1 Create `packages/axon/package.json` with name `@memex/axon`, deps on `@memex/cortex` and `neverthrow`
- [x] 1.2 Create `packages/axon/tsconfig.json` extending workspace typescript-config
- [x] 1.3 Add `packages/axon` to pnpm workspace and root `tsconfig.json` references

## 2. Core Client

- [x] 2.1 Create `src/axon-client.ts` with `AxonClient` class: constructor validates sessionId, derives socket path via `IPC_SOCKET_PATH`
- [x] 2.2 Implement persistent socket connection with lazy connect on first call
- [x] 2.3 Implement newline-delimited JSON framing: write requests, parse response frames
- [x] 2.4 Implement in-flight request map keyed by UUID; resolve/reject on matching response frame
- [x] 2.5 Implement per-call timeout: `setTimeout` rejects the promise, does not destroy socket
- [x] 2.6 Implement reconnect: linear backoff, max 3 attempts; queued calls resolve or reject after reconnect

## 3. Typed Method Surface

- [x] 3.1 Implement `recall(query, options?, timeoutMs?)` → typed result
- [x] 3.2 Implement `getContext(payload, timeoutMs?)` → string
- [x] 3.3 Implement `getRecent(limit, timeoutMs?)` → `LtmRecord[]`
- [x] 3.4 Implement `getStats(timeoutMs?)` → `MemoryStats`
- [x] 3.5 Implement `logInsight(payload, opts?)` — fire-and-forget overload (no response tracking)
- [x] 3.6 Implement `insertMemory(data, options?, timeoutMs?)` → number
- [x] 3.7 Implement `importText(text, timeoutMs?)` → `{ inserted: number }`
- [x] 3.8 Implement `consolidate(timeoutMs?)` → void
- [x] 3.9 Implement `disconnect()`: destroy socket, reject all in-flight

## 4. Exports and Tests

- [x] 4.1 Create `src/index.ts` exporting `AxonClient` and types
- [x] 4.2 Write unit tests: concurrent requests resolve correctly, timeout rejects without killing connection, invalid session ID throws at construction
- [x] 4.3 Run `pnpm check` in `packages/axon`, fix any lint/type errors
