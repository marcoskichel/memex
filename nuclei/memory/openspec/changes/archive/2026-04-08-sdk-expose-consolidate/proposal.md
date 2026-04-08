# sdk-expose-consolidate — memory

## What

Extend `Memory.consolidate()` to accept an optional `target` parameter and route accordingly in `MemoryImpl`.

## Changes

- `memory-types.ts`: update `Memory.consolidate()` signature to `consolidate(target?: ConsolidateTarget): Promise<void>`
- Export `ConsolidateTarget = 'amygdala' | 'hippocampus' | 'all'` from `memory-types.ts`
- `memory-impl.ts`: route by target — `amygdala` runs only `amygdala.run()`, `hippocampus` runs only `hippocampus.run()`, `all` (default) runs both in sequence
