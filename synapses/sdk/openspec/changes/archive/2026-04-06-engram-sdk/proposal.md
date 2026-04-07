# engram-sdk

## Why

There is no installable package for app developers building agents with Neurome. All sub-packages are `private: true` and require monorepo access. `@neurome/sdk` is the single published entry point: it bundles cortex, axon, and dendrite, manages process lifecycle, and exposes the `Engram` abstraction so app developers interact only with a clean, domain-correct API.

## What Changes

- New package `synapses/sdk` published as `@neurome/sdk` — the only public package in the monorepo
- Sub-packages (`cortex`, `axon`, `dendrite`, `memory`, `ltm`, etc.) remain `private: true`
- Built with a bundler (tsup); cortex and dendrite scripts included in the SDK's `dist/`

### `startEngram(config): Promise<Engram>`

Spawns cortex as a managed child process. If `source` is provided, runs `VACUUM INTO forkPath` before starting cortex on the fork. Returns a connected `Engram`.

```ts
interface StartEngramConfig {
  engramId: string;
  db: string; // path to the database file this engram uses
  source?: string; // if set, fork source into db before starting
}
```

### `Engram` class

Wraps `AxonClient`. Exposes:

- `recall(query, options?)` — semantic search
- `logInsight(payload)` — fire-and-forget observation
- `insertMemory(data, options?)` — direct LTM insert
- `getRecent(limit)` — latest records
- `getStats()` — system statistics
- `fork(outputPath): Promise<string>` — snapshot current db; returns path for use as `source` in a new `startEngram` call
- `close(): Promise<void>` — graceful shutdown; terminates the cortex child process
- `asMcpServer(): McpServerConfig` — returns MCP server config for use with Claude Agent SDK and any MCP-compatible framework

### `asMcpServer()` return shape

```ts
{
  type: 'stdio',
  command: 'node',
  args: ['/path/to/sdk/dist/bin/dendrite.js'],
  env: { NEUROME_ENGRAM_ID: '...', NEUROME_DB_PATH: '...' }
}
```

SDK resolves the dendrite script path relative to its own `dist/` — no user configuration needed.

## Add to workspace

- Add `sdk` scope to `openspec/workspace.yaml` with path `synapses/sdk`

## Impact

- App developers: `npm install @neurome/sdk` → `import { startEngram } from '@neurome/sdk'`
- Sub-packages remain private; SDK manages all process lifecycle
- App manages engram lifecycle: `startEngram` → use → optionally `fork` → `close`
