## 1. Socket Client

- [ ] 1.1 Create `src/shell/clients/cortex-socket-client.ts` — `sendLogInsight(payload, sessionId)` with 50ms timeout and `getContext(payload, sessionId)` with 200ms timeout; both catch all errors and return gracefully
- [ ] 1.2 Import and use `IPC_SOCKET_PATH` from `@memex/cortex` protocol types for socket path derivation

## 2. Rewrite post-tool-use

- [ ] 2.1 Update `src/bin/post-tool-use.ts` to call `sendLogInsight` via `cortex-socket-client` instead of `writeInsight` + `writeContextFile`
- [ ] 2.2 Remove `MEMORY_CONTEXT_DIR` env var requirement from `post-tool-use` (cortex handles context files)

## 3. Rewrite pre-tool-use

- [ ] 3.1 Update `src/bin/pre-tool-use.ts` to call `getContext` via `cortex-socket-client` instead of `readContextFiles` + `formatContext`
- [ ] 3.2 On empty/failed response, write nothing to stdout and exit 0 (no fallback file read)

## 4. Remove dead code

- [ ] 4.1 Delete `src/shell/clients/insight-writer.ts`
- [ ] 4.2 Delete `src/shell/clients/context-file-writer.ts`
- [ ] 4.3 Delete `src/shell/clients/context-reader.ts`
- [ ] 4.4 Delete `src/core/format-context.ts` (no longer needed)
- [ ] 4.5 Remove `@memex/stm` from `package.json` dependencies

## 5. Update package.json

- [ ] 5.1 Add `@memex/cortex` as a dependency (for protocol types)
- [ ] 5.2 Run `pnpm install` to update lockfile

## 6. Tests

- [ ] 6.1 Update `post-tool-use` tests: mock `cortex-socket-client` instead of `insight-writer`/`context-file-writer`
- [ ] 6.2 Update `pre-tool-use` tests: mock `cortex-socket-client` instead of `context-reader`
- [ ] 6.3 Unit test `cortex-socket-client.ts` — timeout behavior, exit-0 on error
- [ ] 6.4 Run `pnpm --filter @memex/claude-hooks build && pnpm --filter @memex/claude-hooks test`
