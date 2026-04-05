## 1. Package Setup

- [x] 1.1 Create `synapses/claude-hooks/package.json`: `private: true`, `type: "module"`, `bin: { "post-tool-use": "./dist/bin/post-tool-use.js", "pre-tool-use": "./dist/bin/pre-tool-use.js" }`, standard scripts
- [x] 1.2 Create `synapses/claude-hooks/tsconfig.json` extending `@neurokit/typescript-config`
- [x] 1.3 Add `@neurokit/stm`, `@neurokit/ltm` as workspace dependencies in `package.json`
- [x] 1.4 Run `pnpm install` to link workspace deps

## 2. Core — Pure Functions

- [x] 2.1 Create `src/core/parse-hook-payload.ts`: define `HookPayload` Zod schema for `PostToolUse` payload shape; export `parseHookPayload(raw: string): Result<HookPayload, ParseError>` using `fromThrowable(JSON.parse)` + Zod parse
- [x] 2.2 Define `ParseError` discriminated union: `MALFORMED_JSON | INVALID_SHAPE`
- [x] 2.3 Create `src/core/format-context.ts`: export `formatContext(files: string[]): string` — concatenate file contents with `---` separator; return empty string for empty input
- [x] 2.4 Unit test: `parseHookPayload` returns `ok` for valid payload
- [x] 2.5 Unit test: `parseHookPayload` returns `err(MALFORMED_JSON)` for invalid JSON
- [x] 2.6 Unit test: `parseHookPayload` returns `err(INVALID_SHAPE)` for missing required fields
- [x] 2.7 Unit test: `formatContext` returns empty string for empty array
- [x] 2.8 Unit test: `formatContext` joins multiple files with separator

## 3. Shell — I/O Clients

- [x] 3.1 Create `src/shell/clients/insight-writer.ts`: export `appendInsight(opts: { dbPath: string; sessionId: string; payload: HookPayload }): void` — construct `SqliteInsightLog`, build `InsightEntry` (summary = `${payload.tool_name}: ${truncate(JSON.stringify(payload.tool_response), 500)}`), call `log.append(entry)`
- [x] 3.2 Create `src/shell/clients/context-file-writer.ts`: export `writeContextFile(opts: { contextDir: string; sessionId: string; payload: HookPayload }): void` — ensure session dir exists, write markdown file with tool name, input, response
- [x] 3.3 Create `src/shell/clients/context-reader.ts`: export `readContextFiles(opts: { contextDir: string; sessionId: string; limit: number }): string[]` — read dir, sort by mtime desc, read top `limit` files; return `[]` if dir does not exist
- [x] 3.4 Unit test: `appendInsight` with `:memory:` DB — verify row inserted via `log.allEntries()`
- [x] 3.5 Unit test: `writeContextFile` writes file to correct path with expected content
- [x] 3.6 Unit test: `readContextFiles` returns empty array when dir does not exist
- [x] 3.7 Unit test: `readContextFiles` returns files sorted by mtime, capped at `limit`

## 4. Bin Entry Points

- [x] 4.1 Create `src/bin/post-tool-use.ts`: read stdin, call `parseHookPayload`, call `appendInsight`, call `writeContextFile`; on any error log to stderr and exit 0
- [x] 4.2 Create `src/bin/pre-tool-use.ts`: read `MEMORY_DB_PATH`, `MEMORY_SESSION_ID` from env; call `readContextFiles`; call `formatContext`; write to stdout; exit 0 even if env vars missing (output nothing)

## 5. Build Verification

- [x] 5.1 Run `pnpm --filter claude-hooks build` — no errors
- [x] 5.2 Run `pnpm --filter claude-hooks check` — lint, typecheck, tests all pass
- [ ] 5.3 Manual smoke test: pipe a valid `PostToolUse` JSON payload to `node dist/bin/post-tool-use.js` with `MEMORY_DB_PATH` set — verify row in SQLite and context file on disk
