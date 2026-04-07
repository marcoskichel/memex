# Contributing to Neurome

## Before you start

Open an issue before submitting a PR for substantial changes. This avoids wasted effort if the direction doesn't align with the project.

For small fixes (typos, docs, obvious bugs), a PR without an issue is fine.

## Setup

```bash
git clone https://github.com/marcoskichel/neurome.git
cd neurome
pnpm install
pnpm build
```

## Development commands

```bash
pnpm build    # build all packages
pnpm lint     # lint
pnpm test     # run tests
```

## Commit convention

This project uses [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>(<scope>): <subject>
```

Types: `feat`, `fix`, `refactor`, `chore`, `test`, `docs`

## PR process

1. Fork the repo and create a branch from `master`
2. Implement your change with tests
3. Ensure `pnpm lint` and `pnpm test` pass
4. Open a PR — the template will guide you

## License

By contributing, you agree your changes are licensed under the [MIT License](./LICENSE).
