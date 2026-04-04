## Why

The name `neurokit` is taken by a well-established Python neuroscience library on GitHub, creating confusion and blocking open-source publication. The project needs a distinct identity before any packages are published.

## What Changes

- **BREAKING** Rename npm namespace `@neurokit/*` → `@memex/*` across all packages
- Rename root `package.json` name from `neurokit` to `memex`
- Update all internal workspace cross-references (`workspace:*` deps)
- Update all import paths and references in source, tests, and config files
- Rename GitHub repository from `neurokit` → `memex`
- Add `NAME.md` at the repo root documenting the name origin

## Capabilities

### New Capabilities

- `name-origin`: Documents the Memex name etymology and rationale for future contributors

### Modified Capabilities

<!-- None — this is a rename only; no spec-level behavior changes -->

## Impact

- All packages: `package.json` name field
- All source files referencing `@neurokit/*` imports
- `pnpm-workspace.yaml`, `turbo.json`, `eslint.config.mjs`, tsconfig files
- GitHub repository URL and any badges/links in docs
- Must be applied **after** `human-like-agent-memory` and `port-neural-memory-db` changes are complete to avoid merge conflicts on files those changes touch
