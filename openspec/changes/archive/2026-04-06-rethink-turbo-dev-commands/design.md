## Context

The monorepo uses Turborepo with `"ui": "tui"` globally set. All packages have `dev` (`tsc --watch`) and some have `dev:run` (`node --watch`). The root `dev` script currently fans out to cortex and all transitive deps via `--filter=@neurome/cortex...`, blending package watchers and the cortex process into one turbo run. The tui process is already run outside turbo via `dev:tui`.

## Goals / Non-Goals

**Goals:**

- Separate package watch compilation from cortex execution
- Keep cortex dev workflow using turbo TUI for process navigation
- Keep tui interactive (outside turbo)
- Simple, predictable scripts with clear ownership

**Non-Goals:**

- Changing any build outputs, tsconfig, or compilation behavior
- Adding new npm dependencies (no `concurrently` etc.)
- Modifying per-package scripts

## Decisions

**`dev:packages` uses negative filter `--filter=!@neurome/cortex`**

Rationale: captures all current and future library packages automatically without an explicit allowlist. Tui's tsc watch is intentionally included — it's compilation infrastructure, not a runnable process. The alternative (listing packages by path `./packages/*`) would silently miss new synapses and require maintenance.

**`dev:cortex` filters only `@neurome/cortex` (no `...`)**

Rationale: dropping the transitive `...` suffix means turbo only starts cortex's own `dev` and `dev:run`. Turbo's `dev:run.dependsOn: ["build"]` ensures cortex is compiled before the node process starts; if packages aren't pre-built by `dev:packages`, turbo will do a one-shot build of them via the `build` task's `^build` dependency. This is acceptable — the common workflow runs `dev:packages` first.

**No changes to `turbo.json`**

The existing task definitions (`dev`, `dev:run`, `build`) already support the new script shapes. `"ui": "tui"` is already set globally, so both `dev:packages` and `dev:cortex` will use the turbo TUI automatically.

**Remove root `dev` script**

The old `dev` script is superseded. Keeping it would cause confusion about which to use.

## Risks / Trade-offs

- [Risk] Developer runs `dev:cortex` without `dev:packages` → packages built once (not watched); changes to libs won't hot-reload. Mitigation: document workflow in README; no silent failure.
- [Risk] New package added to monorepo → automatically picked up by `dev:packages` negative filter. This is the desired behavior but worth being aware of.

## Migration Plan

1. Update `package.json` root scripts (one atomic commit)
2. No rollback complexity — scripts are additive/rename only; revert is a one-line diff
