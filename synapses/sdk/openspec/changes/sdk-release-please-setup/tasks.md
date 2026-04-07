## 1. Package Preparation

- [x] 1.1 Add `files` field to `synapses/sdk/package.json` restricting publish output to `["dist", "README.md"]`
- [x] 1.2 Add `prepublishOnly` script to `synapses/sdk/package.json` that runs `pnpm run build`
- [x] 1.3 Add `clean` script to `synapses/sdk/package.json` that removes `dist/` before build (update `build` to run `clean` first)
- [x] 1.4 Run `npm pack --dry-run` in `synapses/sdk` and verify tarball contents match spec (only `dist/`, `README.md`, `package.json`, `LICENSE`)
- [x] 1.5 Verify `dist/` output contains no `.ts` source files, test files, or config files after a clean build

## 2. Release-please Monorepo Config

- [x] 2.1 Create `release-please-config.json` at monorepo root with manifest strategy, `node` release type, scoped to `synapses/sdk`
- [x] 2.2 Create `.release-please-manifest.json` at monorepo root with initial version `{"synapses/sdk": "0.0.1"}`

## 3. Release GitHub Actions Workflow

- [x] 3.1 Create `.github/workflows/release.yml` with release-please job using `google-github-actions/release-please-action@v4` with `manifest` strategy
- [x] 3.2 Add publish job to `release.yml` that runs only when `releases_created` is true, installs deps with `pnpm install --frozen-lockfile`, and publishes via `pnpm --filter @neurome/sdk publish --access public --no-git-checks`
- [x] 3.3 Set correct permissions on the workflow (`contents: write`, `pull-requests: write`)
- [x] 3.4 Document `NPM_TOKEN` secret requirement in `CONTRIBUTING.md` or repo README

## 4. Validation

- [x] 4.1 Confirm `pnpm run build` in `synapses/sdk` produces clean `dist/` with `.js`, `.d.ts` files only
- [x] 4.2 Run `npm pack --dry-run` and confirm no unexpected files in tarball
- [x] 4.3 Verify `release-please-config.json` is valid JSON and passes `release-please` schema validation
- [x] 4.4 Open a test PR with a `feat:` commit and confirm release-please would trigger (dry-run or review workflow YAML logic)
