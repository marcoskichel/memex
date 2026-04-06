## Context

The monorepo currently has two top-level directories for packages: `synapses/` (runnable entry points) and `packages/` (shared libraries). Everything in `packages/` uses neuroscience-themed names (`amygdala`, `hippocampus`, `cortex`, etc.) except the directory itself. Additionally, `packages/cortex` is a daemon process that also exports its IPC protocol types directly — consumers import both the binary and the protocol contract from the same package.

Current layout:

```
synapses/   afferent, claude-hooks, dendrite, neurome-tui
packages/   amygdala, axon, cortex, cortex, hippocampus, llm, ltm, memory, stm, eslint-config, typescript-config
```

## Goals / Non-Goals

**Goals:**

- Rename `packages/` → `nuclei/` throughout (directory, pnpm workspace, turbo, openspec)
- Split `packages/cortex` into `synapses/cortex` (daemon) and `nuclei/cortex-ipc` (protocol contract)
- Update all import sites to use `@neurome/cortex-ipc` for protocol types
- Keep all `@neurome/*` package names unchanged — no npm scope changes

**Non-Goals:**

- Changing any runtime behavior, IPC protocol, or socket paths
- Renaming individual packages (amygdala, hippocampus, etc.)
- Modifying the cortex daemon logic or memory system behavior

## Decisions

### D1: `nuclei` over `glia` for the shared libraries directory

`nuclei` wins because the packages _are already named after brain nuclei_ (hippocampus, amygdala, cortex). The directory name literally describes its contents. `glia` would be accurate metaphorically ("support tissue") but is less well-known and doesn't map to the existing package names.

Alternatives considered:

- `glia`: Perfect metaphor (support cells enable synapses) but weaker recognition and doesn't align with how the sub-packages are named
- `soma`: Too abstract; refers to cell bodies, not functional regions

### D2: Split cortex rather than just move it

Moving `cortex` wholesale to `synapses/` would leave consumers importing a shared protocol contract from a sibling synapse — coupling direction goes the wrong way. Splitting into daemon + protocol package gives each piece the correct home and makes the IPC contract an explicit, independent artifact.

New package names:

- `@neurome/cortex` (in `synapses/cortex`) — the daemon; keeps its name
- `@neurome/cortex-ipc` (in `nuclei/cortex-ipc`) — protocol types only; new package

Alternatives considered:

- Move cortex as-is to `synapses/`: Simpler but creates a synapse-imports-synapse dependency pattern, which is architecturally awkward
- Keep cortex in `nuclei/` as-is: Leaves a runnable daemon misclassified as a shared library

### D3: Keep `@neurome/cortex` as the daemon package name

The daemon is the primary thing called "cortex" — it's the active processing center. Renaming the daemon would break any external scripts or documentation referencing it. The new IPC-only package gets a new name (`cortex-ipc`) to signal it's the narrow protocol surface.

## Risks / Trade-offs

- **Directory rename is mechanical but broad** → Any hardcoded `packages/` path strings in scripts, CI, or docs will break. Mitigation: grep for `packages/` references before finalizing.
- **Two packages where one existed** → Consumers need an import update. Mitigation: the change is mechanical — swap `@neurome/cortex` for `@neurome/cortex-ipc` in all three consumer synapses. TypeScript will catch any missed sites at build time.
- **`openspec/workspace.yaml` scope paths** → All `packages/*` paths need updating to `nuclei/*`. Mitigation: included in tasks.

## Migration Plan

1. Create `nuclei/cortex-ipc` with extracted IPC types from `packages/cortex/src/ipc/protocol.ts`
2. Rename `packages/cortex` → `synapses/cortex`, update its `package.json` to depend on `@neurome/cortex-ipc` instead of inlining the types
3. Rename `packages/` → `nuclei/` (git mv preserves history)
4. Update `pnpm-workspace.yaml` globs: `nuclei/*` instead of `packages/*`
5. Update `turbo.json` if it references `packages/` paths
6. Update `openspec/workspace.yaml` scope paths
7. Update all three consumer synapses: replace `@neurome/cortex` imports with `@neurome/cortex-ipc`
8. Run `pnpm install && pnpm build` to verify

Rollback: all changes are file-system moves and import updates — trivially reversible with `git revert`.

## Open Questions

- None — the approach is well-defined. All decisions are captured above.
