## 1. Package Scaffold

- [x] 1.1 Create `synapses/memex-observer/` directory with `package.json`, `tsconfig.json`, `eslint.config.mjs`
- [x] 1.2 Add `memex-observer` scope to `openspec/workspace.yaml`
- [x] 1.3 Add `synapses/memex-observer` to root `pnpm-workspace.yaml`
- [x] 1.4 Register ESLint overrides for `synapses/memex-observer` in root `eslint.config.mjs`

## 2. Core Implementation

- [x] 2.1 Define local `AgentEvent` interface and `buildFrame(event, runId)` function mapping each event type to a `logInsight` summary and tags
- [x] 2.2 Implement `createMemexObserver(sessionId)`: open persistent socket, queue pre-connect events, flush on connect, swallow socket errors
- [x] 2.3 Export `createMemexObserver` from `src/index.ts`

## 3. Tests

- [x] 3.1 Test: events buffered before connect are flushed in order once socket connects
- [x] 3.2 Test: each `AgentEvent` type produces the correct `logInsight` summary and tags
- [x] 3.3 Test: socket error does not throw or affect the observer callback
- [x] 3.4 Test: all events from one observer instance share the same `runId` tag

## 4. Integration

- [x] 4.1 Build and typecheck the package (`pnpm --filter @memex/observer build && tsc --noEmit`)
- [x] 4.2 Verify the package lints clean under root `eslint.config.mjs`
