## Context

The monorepo uses `@memex` as the npm scope across 13 packages. The rename to `@neurome` is a mechanical find-and-replace with one non-trivial concern: the IPC socket path string in `packages/cortex/src/ipc/protocol.ts` is a runtime value, not just a package name — changing it is a breaking change for any running cortex daemon.

## Goals / Non-Goals

**Goals:**

- Rename all `@memex/*` package names to `@neurome/*`
- Update all internal import paths
- Rename `memex-tui` directory and package to `neurome-tui`
- Update the socket path string

**Non-Goals:**

- Changing any API, interface, or behavior
- Updating external documentation or published packages (project is private)
- Renaming the git repository or root directory (`neurokit` stays)

## Decisions

**Socket path: rename to `/tmp/neurome-<id>.sock`**
The old path `/tmp/memex-<id>.sock` must be updated. Any process still connecting to the old path will fail to find the socket. Mitigation: restart cortex and all consumers (claude-hooks, afferent) after the rename. Since this is a local dev project, no live migration is needed.

**`memex-tui` directory rename**
`synapses/memex-tui` → `synapses/neurome-tui` using `git mv` to preserve history. Package name becomes `@neurome/neurome-tui`. The `openspec/workspace.yaml` scope path is updated accordingly.

**Mechanical rename order**

1. Package names in all `package.json` files
2. Internal imports in all `.ts` files
3. Root `package.json` scripts and workspace deps
4. Socket path string in `cortex/src/ipc/protocol.ts`
5. `git mv synapses/memex-tui synapses/neurome-tui`
6. `openspec/workspace.yaml` path update
7. `pnpm install` to relink workspace deps

**No scope for external publishing**
All packages are `"private": true`. No npm registry changes needed.

## Risks / Trade-offs

**[Risk]** Running cortex daemon uses old socket path → Mitigation: stop cortex before renaming, restart after. Document in commit message.

**[Risk]** `turbo.json` or other config files reference `@memex` filters → Mitigation: grep for any remaining `@memex` references after the rename pass and fix before committing.
