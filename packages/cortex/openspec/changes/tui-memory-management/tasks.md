## 1. Protocol + Handlers

- [x] 1.1 Add `InsertMemoryPayload: { data: string; options?: LtmInsertOptions }` to `src/ipc/protocol.ts` and register in `RequestPayloadMap`
- [x] 1.2 Add `ImportTextPayload: { text: string }` to `src/ipc/protocol.ts` and register in `RequestPayloadMap`
- [x] 1.3 Add `GetRecentPayload: { limit: number }` to `src/ipc/protocol.ts` and register in `RequestPayloadMap`
- [x] 1.4 Add `insertMemory` dispatch case in `src/ipc/handlers.ts` — delegates to `memory.insertMemory(payload.data, payload.options)`
- [x] 1.5 Add `importText` dispatch case in `src/ipc/handlers.ts` — delegates to `memory.importText(payload.text)`
- [x] 1.6 Add `getRecent` dispatch case in `src/ipc/handlers.ts` — delegates to `memory.getRecent(payload.limit)`
- [x] 1.7 Add unit tests in `src/__tests__/ipc/handlers.test.ts`: each handler dispatches correctly; unknown type still throws
