## Context

The monorepo uses pnpm workspaces + Turborepo. `@neurome/sdk` (`synapses/sdk`) is the only public package intended for npm publish. There is currently no release tooling — no changelog, no version automation, no publish pipeline. The GitHub Actions CI workflow runs lint/build/test on `master` and PRs but has no release step.

Release-please is the chosen tool because it integrates natively with GitHub Actions, generates structured changelogs from conventional commits, and supports monorepo mode via manifest config — allowing it to track only `synapses/sdk` without interfering with private packages.

## Goals / Non-Goals

**Goals:**

- Automate version bumps and `CHANGELOG.md` generation for `@neurome/sdk` on every push to `master`
- Publish `@neurome/sdk` to npm automatically when a release PR is merged
- Restrict published package to only `dist/` and metadata (no source, no test files, no internal workspace artifacts)
- Enforce a build before publish via `prepublishOnly`

**Non-Goals:**

- Releasing any other package in the monorepo (all others are private)
- Publishing to a private registry
- Automating releases for git tags outside the release-please flow

## Decisions

### 1. Release-please manifest mode (vs. single-package mode)

Manifest mode (`release-please-config.json` + `.release-please-manifest.json`) is required for monorepos. It tracks per-package versions independently and allows scoping release-please to `synapses/sdk` only. Single-package mode would attempt to version the root, which is private.

### 2. Publish step in the release workflow (vs. separate workflow)

The release and publish steps are co-located in `release.yml`. When release-please creates a release, the same job publishes to npm using the `NPM_TOKEN` secret. Alternative (separate workflow triggered by GitHub Release event) adds indirection without benefit.

### 3. `files` field in package.json (vs. `.npmignore`)

`files` is an allowlist — safer than `.npmignore` (denylist). Any new file added to the package is excluded by default unless explicitly added to `files`. This prevents accidental leaks (source, configs, test fixtures).

Published contents: `dist/`, `README.md`, `package.json` (always included by npm), `LICENSE` (always included by npm).

### 4. `prepublishOnly` script

Runs `pnpm run build` before publish. Ensures `dist/` is always fresh. Fails fast if build is broken — publish never proceeds with stale artifacts.

### 5. `workspace:*` dependencies handling

`@neurome/axon`, `@neurome/cortex`, `@neurome/dendrite` are listed as `dependencies` with `workspace:*`. These are private packages and will not be on npm. Before publishing, these must be resolved to real npm packages or removed from `dependencies`. This is a **known blocker** — see Risks.

## Risks / Trade-offs

- [workspace:* deps are private and not on npm] → Resolution: before this release automation is activated, the SDK's internal dependencies must either be published to npm or the SDK must bundle/inline them. This change should gate publish behind a version check or document this prerequisite clearly.
- [NPM_TOKEN expiry] → Mitigation: use a granular npm automation token scoped only to `@neurome/sdk`; rotate on a schedule; CI will fail visibly on expiry.
- [release-please bot needs write permissions] → Mitigation: grant `contents: write` and `pull-requests: write` in the workflow permissions block.
- [dist/ may contain stale output from a previous build] → Mitigation: `prepublishOnly` always rebuilds; `clean` step before build (remove `dist/` before `tsc`) prevents stale artifact accumulation.
