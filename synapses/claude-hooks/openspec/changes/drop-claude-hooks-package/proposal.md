## Why

The `claude-hooks` package (`@neurome/claude-hooks`) is unused — no package in the monorepo depends on or imports it — and the Claude Code hook integration it provided is no longer needed. Keeping it around adds maintenance overhead with no benefit.

## What Changes

- **BREAKING** Delete the `synapses/claude-hooks` directory and all its contents
- Remove `@neurome/claude-hooks` from monorepo workspace (it is automatically excluded once the directory is gone)

## Capabilities

### New Capabilities

- none

### Modified Capabilities

- none

## Impact

- The `pre-tool-use` and `post-tool-use` CLI binaries provided by this package will no longer be available
- `@neurome/axon` loses one consumer (claude-hooks was its only downstream user in the monorepo other than dendrite)
- No other package is affected; zero import references exist outside of claude-hooks itself
