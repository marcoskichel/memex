## Why

`@neurome/sdk` is a public-facing package with no automated release process — versions are bumped manually, no changelog is generated, and there is no publish pipeline. This makes reliable, auditable releases to npm impossible.

## What Changes

- Add `release-please-config.json` and `.release-please-manifest.json` at monorepo root to configure release-please in monorepo mode scoped to `synapses/sdk`
- Add `.github/workflows/release.yml` GitHub Actions workflow that runs release-please on `master` pushes and publishes to npm on release
- Add `files` field to `synapses/sdk/package.json` to restrict publish output to `dist/` and `README.md`
- Add `prepublishOnly` script to `synapses/sdk/package.json` to enforce a clean build before publish
- Validate `dist/` output is correct and safe (no source maps with secrets, no test files, no internal workspace paths leaked)

## Capabilities

### New Capabilities

- `sdk-release-automation`: Automated versioning, changelog generation, and npm publish for `@neurome/sdk` via release-please and GitHub Actions

### Modified Capabilities

<!-- none -->

## Impact

- `.github/workflows/`: new `release.yml` workflow added; existing `ci.yml` unchanged
- Monorepo root: `release-please-config.json`, `.release-please-manifest.json` added
- `synapses/sdk/package.json`: `files`, `prepublishOnly` added
- No runtime code changes; no API surface changes
- Requires `NPM_TOKEN` secret set in GitHub repo settings
