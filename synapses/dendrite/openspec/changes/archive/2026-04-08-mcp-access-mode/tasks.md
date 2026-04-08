## 1. Bin entry point

- [x] 1.1 Read `NEUROME_ACCESS_MODE` from `process.env` in `src/bin/dendrite.ts`
- [x] 1.2 Pass resolved access mode to `run(engramId, accessMode)`

## 2. Index

- [x] 2.1 Update `run()` signature in `src/index.ts` to accept `accessMode: string`
- [x] 2.2 Forward `accessMode` to `startServer(axon, engramId, accessMode)`

## 3. Server

- [x] 3.1 Update `createServer()` and `startServer()` signatures to accept `accessMode: string`
- [x] 3.2 Add `registerLogInsight(server, axon)` function in `src/server.ts`
- [x] 3.3 Call `registerLogInsight` inside `createServer` when `accessMode === 'full'`

## 4. Tests

- [x] 4.1 Add a separate `createServer` instance with `accessMode: 'full'` in the test file; do not modify the existing 4-tool read-only suite
- [x] 4.2 Assert `log_insight` is registered in full mode and absent in read-only and unrecognized-mode instances
- [x] 4.3 Add unit test for `log_insight` handler: maps `insight` to `axon.logInsight({ summary, contextFile: '' })` and returns `{ logged: true }`
- [x] 4.4 Add unit test for `log_insight` handler: rejects input exceeding 10,000 characters without calling `axon.logInsight`
