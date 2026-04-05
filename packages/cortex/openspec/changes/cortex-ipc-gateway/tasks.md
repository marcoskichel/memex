## 1. Protocol Types

- [ ] 1.1 Create `src/ipc/protocol.ts` — define `RequestMessage`, `ResponseMessage`, `PushMessage` types and all payload shapes (`LogInsightPayload`, `GetContextPayload`, `RecallPayload`); export `IPC_SOCKET_PATH` helper that takes a sessionId
- [ ] 1.2 Export protocol types from `src/index.ts` for use by claude-hooks and memex-tui

## 2. Socket Server

- [ ] 2.1 Create `src/ipc/socket-server.ts` — `SocketServer` class with `start()`, `stop()`, and `broadcast(message)` methods using Node `net.createServer`
- [ ] 2.2 Implement stale socket detection in `start()`: if path exists and connect fails immediately, unlink and proceed
- [ ] 2.3 Implement client set management: add on connect, remove on close/error
- [ ] 2.4 Implement NDJSON line buffering per client (handle fragmented writes)

## 3. Message Handlers

- [ ] 3.1 Create `src/ipc/handlers.ts` — `handleRequest(type, payload, memory)` dispatcher that routes to `logInsight`, `getContext`, `recall`, `getStats`
- [ ] 3.2 Implement `logInsight` handler: calls `memory.logInsight()` (cortex now owns the write, not the hook)
- [ ] 3.3 Implement `getContext` handler: calls `memory.recall(JSON.stringify(toolInput), { limit: 5 })`, blends top results with recent context files, returns formatted markdown
- [ ] 3.4 Implement `recall` handler: delegates to `memory.recall()`, serializes result
- [ ] 3.5 Implement `getStats` handler: delegates to `memory.getStats()`
- [ ] 3.6 Handle unknown request type: respond with `{ ok: false, error: "unknown request type" }`

## 4. Event Broadcast Wiring

- [ ] 4.1 After `createMemory()` resolves, register one listener per `MemoryEvents` key that calls `server.broadcast()` with the event push message format

## 5. Cortex Core Integration

- [ ] 5.1 Update `cortex-core.ts` `main()` to instantiate `SocketServer` after Memory is ready, start it, and pass it the Memory instance
- [ ] 5.2 Call `server.stop()` during `shutdownOnce()` before process exit
- [ ] 5.3 Ensure socket file is removed on `process.on('exit')`

## 6. Tests

- [ ] 6.1 Unit test `protocol.ts` — `IPC_SOCKET_PATH` generates correct path
- [ ] 6.2 Unit test `handlers.ts` — each handler calls the right Memory method and returns correct response shape
- [ ] 6.3 Integration test `socket-server.ts` — connect client, send request, verify response; connect two clients, verify broadcast reaches both
- [ ] 6.4 Run `pnpm --filter @memex/cortex build && pnpm --filter @memex/cortex test`
