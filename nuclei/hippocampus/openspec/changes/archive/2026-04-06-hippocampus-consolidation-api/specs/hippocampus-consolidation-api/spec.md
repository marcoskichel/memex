## manual-consolidation

`HippocampusProcess.run()` SHALL be public.

`HippocampusProcess.start()` SHALL skip creating the `setInterval` when `scheduleMs` is `0`,
leaving consolidation exclusively manual in that mode.
