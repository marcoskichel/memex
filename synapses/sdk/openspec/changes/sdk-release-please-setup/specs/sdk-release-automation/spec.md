## ADDED Requirements

### Requirement: Release-please monorepo configuration

The repository SHALL include `release-please-config.json` at the monorepo root configuring release-please in manifest mode, scoped to `synapses/sdk`, using the `node` release type and conventional commits.

The repository SHALL include `.release-please-manifest.json` at the monorepo root tracking the current version of `synapses/sdk`.

#### Scenario: Config files present and valid

- **WHEN** release-please runs on a push to `master`
- **THEN** it reads `release-please-config.json` and `.release-please-manifest.json` from the repo root
- **THEN** it processes only commits affecting `synapses/sdk` for versioning

### Requirement: Release GitHub Actions workflow

The repository SHALL include `.github/workflows/release.yml` that runs on every push to `master` and performs two jobs: release-please PR management and npm publish on release.

The workflow SHALL use `google-github-actions/release-please-action` with `manifest` strategy.

The publish job SHALL only run when release-please outputs `releases_created: true`.

The publish job SHALL authenticate to npm using the `NPM_TOKEN` repository secret.

#### Scenario: Conventional commit triggers version bump

- **WHEN** a `feat:` or `fix:` commit lands on `master`
- **THEN** release-please opens or updates a release PR with bumped version and updated `CHANGELOG.md`

#### Scenario: Release PR merged triggers npm publish

- **WHEN** the release PR is merged to `master`
- **THEN** release-please creates a GitHub Release and tag
- **THEN** the publish job runs `pnpm --filter @neurome/sdk publish --access public --no-git-checks`
- **THEN** `@neurome/sdk` is available on npm at the new version

#### Scenario: No releasable commits

- **WHEN** a push to `master` contains no conventional commits affecting `synapses/sdk`
- **THEN** no release PR is opened or updated
- **THEN** no publish occurs

### Requirement: Package publish-safe output

`synapses/sdk/package.json` SHALL declare a `files` field that includes only `dist/` and `README.md`.

`synapses/sdk/package.json` SHALL declare a `prepublishOnly` script that runs `pnpm run build` before publish.

The `dist/` directory SHALL contain only compiled JavaScript (`*.js`), type declarations (`*.d.ts`), and source maps (`*.js.map`, `*.d.ts.map`) — no test files, no `.ts` source files, no config files.

#### Scenario: Published package contents are restricted

- **WHEN** `npm pack` is run in `synapses/sdk`
- **THEN** the tarball contains only files from `dist/`, `README.md`, `package.json`, and `LICENSE`
- **THEN** the tarball does NOT contain `src/`, `tsconfig.json`, `eslint.config.mjs`, `vitest.config.ts`, or `node_modules/`

#### Scenario: prepublishOnly blocks publish on build failure

- **WHEN** `npm publish` is invoked and the TypeScript build fails
- **THEN** `prepublishOnly` exits non-zero
- **THEN** publish is aborted before any files are sent to the registry
