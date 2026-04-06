## ADDED Requirements

### Requirement: Shared libraries live under nuclei/

All shared library packages in the monorepo SHALL reside under the `nuclei/` top-level directory. No shared library package SHALL reside under `packages/` after this change.

#### Scenario: nuclei/ directory contains all shared packages

- **WHEN** listing the top-level monorepo directories
- **THEN** a `nuclei/` directory exists containing amygdala, axon, cortex-ipc, hippocampus, llm, ltm, memory, stm, eslint-config, and typescript-config
- **AND** no `packages/` directory exists at the monorepo root

### Requirement: Runnable processes live under synapses/

All packages with a `bin` entry in their `package.json` SHALL reside under the `synapses/` top-level directory.

#### Scenario: cortex daemon is under synapses/

- **WHEN** listing packages under `synapses/`
- **THEN** `synapses/cortex` exists with a `bin.cortex` entry in its `package.json`
- **AND** no `packages/cortex` or `nuclei/cortex` directory exists

### Requirement: IPC protocol contract is an independent package

The cortex daemon's IPC protocol (socket path constant, message types, request/response shapes) SHALL be published as a standalone package `@neurome/cortex-ipc` in `nuclei/cortex-ipc`. The daemon itself SHALL NOT export these types directly.

#### Scenario: cortex-ipc package is importable

- **WHEN** a synapse declares `@neurome/cortex-ipc` as a dependency
- **THEN** it can import `IPC_SOCKET_PATH` and all protocol types from `@neurome/cortex-ipc`

#### Scenario: cortex daemon imports its own protocol from cortex-ipc

- **WHEN** inspecting `synapses/cortex/package.json`
- **THEN** `@neurome/cortex-ipc` is listed as a dependency
- **AND** the daemon's source imports protocol types from `@neurome/cortex-ipc`, not from local files

### Requirement: Consumer synapses import protocol from cortex-ipc

All synapses that communicate with the cortex daemon SHALL import protocol types from `@neurome/cortex-ipc`. No synapse SHALL import protocol types from `@neurome/cortex` after this change.

#### Scenario: No @neurome/cortex imports in consumer synapses

- **WHEN** grepping `synapses/afferent`, `synapses/claude-hooks`, and `synapses/neurome-tui` source files for `from '@neurome/cortex'`
- **THEN** zero matches are found

#### Scenario: pnpm install resolves the workspace

- **WHEN** `pnpm install` is run at the monorepo root
- **THEN** all workspace packages resolve without errors
- **AND** `@neurome/cortex-ipc` resolves to `nuclei/cortex-ipc`
- **AND** `@neurome/cortex` resolves to `synapses/cortex`
