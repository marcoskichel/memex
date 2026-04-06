## 1. Update Root Scripts

- [x] 1.1 Remove `dev` script from root `package.json`
- [x] 1.2 Add `dev:packages` script: `turbo run dev --filter=!@neurome/cortex`
- [x] 1.3 Update `dev:cortex` script: `turbo run dev dev:run --filter=@neurome/cortex`
- [x] 1.4 Verify `dev:tui` script is unchanged: `pnpm --filter=@neurome/neurome-tui run dev:run`

## 2. Verify Turbo Config

- [x] 2.1 Confirm `turbo.json` has `"ui": "tui"` set (no change needed if already present)
- [x] 2.2 Confirm no new turbo task definitions are required

## 3. Smoke Test

- [x] 3.1 Run `pnpm dev:packages` — verify turbo TUI starts and tsc watchers run for all packages except cortex
- [x] 3.2 Run `pnpm dev:cortex` — verify turbo TUI shows only cortex tsc + node processes
- [x] 3.3 Run `pnpm dev:tui` — verify tui node process starts interactively outside turbo
- [x] 3.4 Confirm `pnpm dev` reports script not found
