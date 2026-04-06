## manual-consolidation

`Memory` interface SHALL expose `consolidate(): Promise<void>`.

`MemoryImpl.consolidate()` SHALL await `amygdala.run()` then `hippocampus.run()`.

`MemoryConfig.hippocampusScheduleMs` SHALL accept `0` to disable the auto-schedule.
