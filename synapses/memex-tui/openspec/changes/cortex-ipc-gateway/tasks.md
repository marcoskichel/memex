## 1. Package Setup

- [x] 1.1 Create `package.json` for `@memex/memex-tui` with `ink`, `react`, `@memex/cortex` (types), `@memex/memory` (types) dependencies and a `bin` entry for `memex-tui`
- [x] 1.2 Create `tsconfig.json` extending `@memex/typescript-config`
- [x] 1.3 Create `eslint.config.mjs` extending `@memex/eslint-config`
- [x] 1.4 Run `pnpm install` to register the new package in the workspace

## 2. Socket Client

- [x] 2.1 Create `src/client/socket-client.ts` — `MemexSocketClient` class with `connect()`, `disconnect()`, `recall()`, `getStats()`, event emitter for push messages, auto-reconnect with 2s backoff up to 10 attempts
- [x] 2.2 Implement NDJSON line buffering and request/response correlation by `id`
- [x] 2.3 Implement 5s timeout per request; reject Promise on timeout

## 3. Layout Components

- [x] 3.1 Create `src/components/app.tsx` — root Ink component; manages socket client instance, pane focus state, status bar
- [x] 3.2 Create `src/components/status-bar.tsx` — session ID, connection indicator, LTM count, STM pending
- [x] 3.3 Create `src/components/events-pane.tsx` — scrolling event log using `<Static>`, ring buffer of last 200 events, format each event by name
- [x] 3.4 Create `src/components/stats-pane.tsx` — polls `getStats` every 2s, renders LTM/STM/amygdala/hippocampus/disk stats table
- [x] 3.5 Implement `tab` pane focus cycling and highlighted border on focused pane
- [x] 3.6 Implement `q` quit from any non-input context

## 4. Query REPL

- [x] 4.1 Create `src/components/query-repl.tsx` — state machine: idle → typing → loading → results → detail
- [x] 4.2 Implement query input using Ink's `<TextInput>` (or `useInput`); `enter` triggers recall
- [x] 4.3 Render result list: score, record type, date, tags per row; arrow key navigation with highlight
- [x] 4.4 `enter` on selected result fetches full record via socket and shows expanded view
- [x] 4.5 `esc` dismisses detail view or clears results

## 5. Bin Entry

- [x] 5.1 Create `src/bin/memex-tui.ts` — reads `MEMORY_SESSION_ID` from env, derives socket path, renders `<App sessionId={...} />` via `render()` from ink

## 6. Tests

- [x] 6.1 Unit test `socket-client.ts` — mock net.Socket, verify reconnect logic, timeout behavior, event emit on push message
- [x] 6.2 Unit test `query-repl.tsx` — state transitions: idle → loading → results → detail → idle
- [x] 6.3 Run `pnpm --filter @memex/memex-tui build && pnpm --filter @memex/memex-tui test`
