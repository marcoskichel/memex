## Why

The monorepo uses neuroscience-themed naming throughout (`synapses/`, `amygdala`, `hippocampus`, etc.) but the shared libraries directory is still called `packages/` — generic infrastructure jargon that breaks the metaphor. Additionally, `cortex` currently lives in `packages/` despite being a runnable daemon, and it exports its IPC protocol types directly, coupling the daemon's internals to its consumers.

## What Changes

- **BREAKING** Rename `packages/` directory to `nuclei/` — aligns with the neuroscience naming system (brain nuclei are the discrete functional units, which is exactly what shared libraries are)
- **BREAKING** Split `packages/cortex` into two packages:
  - `synapses/cortex` — the runnable daemon (moves from packages to synapses where active processes live)
  - `nuclei/cortex-ipc` — the shared IPC protocol contract (socket path, message types) extracted for consumers
- Update all consumers of `@neurome/cortex` to import from `@neurome/cortex-ipc` for protocol types
- Update `pnpm-workspace.yaml`, `turbo.json`, and `openspec/workspace.yaml` to reflect new paths

## Capabilities

### New Capabilities

- `monorepo-layout`: Directory structure convention for the neurome monorepo — `synapses/` for runnable processes, `nuclei/` for shared libraries, with cortex-ipc as the IPC contract package

### Modified Capabilities

- `namespace-rename`: The directory layout is changing as a continuation of the namespace/structure work

## Impact

- All packages under `packages/` move to `nuclei/` — file paths change but package names (`@neurome/*`) stay the same
- `@neurome/cortex` becomes two packages: `@neurome/cortex` (daemon, in `synapses/`) and `@neurome/cortex-ipc` (protocol, in `nuclei/`)
- All three synapse consumers (`afferent`, `claude-hooks`, `neurome-tui`) update their `@neurome/cortex` imports to `@neurome/cortex-ipc`
- `openspec/workspace.yaml` scope paths updated
- No runtime behavior changes — purely structural
