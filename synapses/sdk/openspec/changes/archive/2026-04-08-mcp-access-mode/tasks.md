## 1. Types

- [x] 1.1 Add `McpAccessMode` type (`'read-only' | 'full'`) to `src/types.ts`
- [x] 1.2 Add `McpServerOptions` interface with `accessMode?: McpAccessMode` to `src/types.ts`
- [x] 1.3 Export `McpAccessMode` and `McpServerOptions` from `src/index.ts`

## 2. Engram

- [x] 2.1 Update `asMcpServer()` signature to accept `options?: McpServerOptions`
- [x] 2.2 Include `NEUROME_ACCESS_MODE` in returned env, defaulting to `'read-only'`

## 3. Tests

- [x] 3.1 Add unit tests for `asMcpServer()`: no options defaults to `read-only`, explicit `read-only`, explicit `full`
