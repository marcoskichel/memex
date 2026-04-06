## Why

The `@memex` namespace is already occupied by multiple AI projects on GitHub and in the broader AI ecosystem, creating discoverability and branding confusion. `neurome` — coined from "neuro" + "-ome" (as in genome, connectome) — is available, fits the neuroscience theme of the codebase, and is distinctive in the AI tooling space.

## What Changes

- All `package.json` `name` fields: `@memex/*` → `@neurome/*`
- All `import`/`require` statements across the monorepo: `@memex/*` → `@neurome/*`
- Root `package.json`: name, scripts, and workspace dependency references
- `packages/cortex` socket path string: `/tmp/memex-<id>.sock` → `/tmp/neurome-<id>.sock` — **BREAKING** for any live cortex + hook processes (requires restart)
- `synapses/memex-tui`: directory rename to `synapses/neurome-tui`, package name `@neurome/neurome-tui`
- `openspec/workspace.yaml`: update `memex-tui` scope path
- `pnpm-workspace.yaml` and `turbo.json` if they contain `@memex` filter references

## Capabilities

### New Capabilities

### Modified Capabilities

## Impact

- All packages and synapses in the monorepo
- Any external consumers of the IPC socket path (claude-hooks, afferent, any local config pointing to `/tmp/memex-*.sock`)
- No API surface changes — this is purely a namespace/string rename
