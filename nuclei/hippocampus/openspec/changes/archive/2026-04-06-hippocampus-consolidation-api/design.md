## Context

`HippocampusProcess.run()` is already public. The only gap is that `start()` passes
`scheduleMs` directly to `setInterval` with no guard — a value of `0` would spin the
interval every tick rather than disabling the schedule.

## Goals / Non-Goals

**Goals:**

- Disable auto-schedule when `scheduleMs` is `0`

**Non-Goals:**

- Changing the default schedule
- Returning a result from `run()`

## Decisions

- Guard: `if (this.scheduleMs === 0) return` at the top of `start()`
- No changes to `run()` — it's already public and correct

## Risks / Trade-offs

- [Risk] Callers currently passing `scheduleMs: 0` unintentionally may see behaviour change
  → Acceptable: passing 0 to setInterval is already broken (runs every tick)
