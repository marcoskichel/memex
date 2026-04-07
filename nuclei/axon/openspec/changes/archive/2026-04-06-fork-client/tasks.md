# Tasks: fork-client

- [x] Import `ForkPayload` from `@neurome/cortex-ipc` in `axon-client.ts`
- [x] Add `fork(outputPath: string, timeoutMs?: number): Promise<string>` to `AxonClient`
- [x] Method sends `{ type: 'fork', payload: { outputPath } }` and returns `result.forkPath`
- [x] Build and tests pass
