## Why

`claude-hooks` has a bespoke `cortex-socket-client.ts` with known reliability issues: correlation IDs hardcoded as `"1"`, ad-hoc per-request connections (no persistence), and silent error swallowing on timeout. With `@memex/axon` available, this one-off client should be replaced.

## What Changes

- Delete `synapses/claude-hooks/src/shell/clients/cortex-socket-client.ts`.
- Replace `sendLogInsight` and `getContext` call sites with `@memex/axon` equivalents.
- Timeout behavior: existing 50ms/200ms timeouts specified in `hook-socket-client` spec are preserved as axon call options.
- Exit-0-on-failure behavior preserved — errors from axon are caught and result in exit 0.

## Capabilities

### New Capabilities

### Modified Capabilities

- `hook-socket-client`: Transport replaced by `@memex/axon`. All existing timeout and failure-handling requirements remain in effect. Correlation ID bug fixed as a side effect.

## Impact

- `synapses/claude-hooks/src/shell/clients/cortex-socket-client.ts` — deleted
- `synapses/claude-hooks/src/bin/pre-tool-use.ts` — updated to use axon
- `synapses/claude-hooks/src/bin/post-tool-use.ts` — updated to use axon
- New dependency: `@memex/axon`
