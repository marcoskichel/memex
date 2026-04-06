## 1. Package Setup

- [ ] 1.1 Create `synapses/dendrite/package.json` with name `@memex/dendrite`, deps on `@memex/axon`, `@modelcontextprotocol/sdk`
- [ ] 1.2 Create `synapses/dendrite/tsconfig.json` extending workspace typescript-config
- [ ] 1.3 Add `synapses/dendrite` to pnpm workspace and root `tsconfig.json` references

## 2. Session Bootstrap

- [ ] 2.1 Create `src/index.ts`: read `MEMEX_SESSION_ID` env var; exit with clear error if missing
- [ ] 2.2 Instantiate `AxonClient(sessionId)` and pass to server factory

## 3. MCP Server

- [ ] 3.1 Create `src/server.ts`: initialise MCP server with `@modelcontextprotocol/sdk` stdio transport
- [ ] 3.2 Register `recall` tool: schema `{ query: string, options?: object }`, delegates to `axon.recall`
- [ ] 3.3 Register `get_context` tool: schema `{ tool_name: string, tool_input: unknown, category?: string }`, delegates to `axon.getContext` with server session ID
- [ ] 3.4 Register `get_recent` tool: schema `{ limit: number }`, delegates to `axon.getRecent`
- [ ] 3.5 Register `get_stats` tool: no input schema, delegates to `axon.getStats`
- [ ] 3.6 Wrap all axon calls in try/catch; return MCP `isError: true` response on failure (do not crash server)

## 4. Bin Entry

- [ ] 4.1 Create `src/bin/dendrite.ts` as the CLI entry point, calls `src/index.ts` bootstrap then starts server
- [ ] 4.2 Add `"bin": { "dendrite": "./dist/bin/dendrite.js" }` to `package.json`

## 5. Tests and Docs

- [ ] 5.1 Write unit tests: missing `MEMEX_SESSION_ID` exits non-zero; no write tools registered; each tool delegates to correct axon method
- [ ] 5.2 Run `pnpm check` in `synapses/dendrite`, fix any lint/type errors
