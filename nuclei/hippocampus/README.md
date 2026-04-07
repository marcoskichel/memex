# `@neurome/hippocampus`

Like its biological namesake, this package consolidates short-term episodic records into durable long-term memories — periodically clustering semantically similar entries and distilling each cluster into a single semantic memory via LLM.

Part of the [Neurome](../../README.md) memory infrastructure.

## Install

```sh
pnpm add @neurome/hippocampus
```

## Usage

```ts
import { HippocampusProcess } from '@neurome/hippocampus';
import type { HippocampusConfig } from '@neurome/hippocampus';

const process = new HippocampusProcess({
  ltm, // LtmEngine instance
  llmAdapter, // LLMAdapter instance
  scheduleMs: 3_600_000, // run every hour (default)
  similarityThreshold: 0.85, // cosine similarity cutoff (default)
  minClusterSize: 3, // ignore clusters smaller than this (default)
  minAccessCount: 2, // skip records accessed fewer times (default)
  maxCreatedAtSpreadDays: 30, // max temporal spread within a cluster (default)
  maxLLMCallsPerHour: 200, // rate-limit guard (default)
  events, // optional EventBus for observability
});

// listen for low-confidence consolidations before starting
events.on('hippocampus:false-memory-risk', (payload) => {
  // => { pendingId, summary, confidence, sourceIds, preservedFacts, uncertainties }
  console.warn('Low-confidence consolidation skipped:', payload);
});

events.on('hippocampus:consolidation:end', (payload) => {
  // => { runId, durationMs, clustersConsolidated, recordsPruned, contextFilesDeleted }
  console.log('Consolidation finished:', payload);
});

// start the background scheduler
process.start();

// trigger a consolidation cycle manually
await process.run();

// stop the scheduler on shutdown
process.stop();
```

## API

| Export                       | Description                                                                |
| ---------------------------- | -------------------------------------------------------------------------- |
| `HippocampusProcess`         | Background worker that runs consolidation cycles on a schedule             |
| `HippocampusProcess#start()` | Starts the interval scheduler; no-op when `scheduleMs` is `0`              |
| `HippocampusProcess#stop()`  | Clears the interval                                                        |
| `HippocampusProcess#run()`   | Runs one consolidation cycle immediately; respects the LLM rate limit      |
| `HippocampusConfig`          | Configuration interface for `HippocampusProcess`                           |
| `ConsolidationResult`        | LLM output shape: `{ summary, confidence, preservedFacts, uncertainties }` |

### Events

| Event                             | Payload                                                                        | When                                                |
| --------------------------------- | ------------------------------------------------------------------------------ | --------------------------------------------------- |
| `hippocampus:consolidation:start` | —                                                                              | Beginning of each cycle                             |
| `hippocampus:consolidation:end`   | `HippocampusConsolidationEndPayload`                                           | End of each cycle                                   |
| `hippocampus:false-memory-risk`   | `{ pendingId, summary, confidence, sourceIds, preservedFacts, uncertainties }` | LLM confidence < 0.5; cluster is NOT written to LTM |

Full API reference → <!-- link to docs -->

## Related

- [`@neurome/ltm`](../ltm/README.md) — long-term memory storage and retrieval
- [`@neurome/amygdala`](../amygdala/README.md) — emotional salience and memory prioritisation
- [`@neurome/memory`](../memory/README.md) — unified memory facade
- [`@neurome/llm`](../llm/README.md) — LLM adapter abstraction used for consolidation

## License

MIT
