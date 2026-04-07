# `@neurome/stm`

Short-term memory for agents — records raw insights during a run and holds them until they are scored and promoted to long-term storage.

Part of the [Neurome](../../README.md) memory infrastructure.

## Install

```sh
pnpm add @neurome/stm
```

## Usage

```ts
import { InsightLog, ContextManager } from '@neurome/stm';

const log = new InsightLog();

// Append an insight manually
const entry = log.append({
  summary: 'User prefers concise responses',
  contextFile: '/tmp/ctx/session-1/abc.ctx',
  tags: ['preference', 'style'],
});
// => { id: 'uuid', summary: '...', processed: false, timestamp: Date, ... }

// Read unprocessed entries (sorted oldest-first)
const pending = log.readUnprocessed();
// => [entry]

// Mark entries as processed after the amygdala scores them
log.markProcessed([entry.id]);

// Clear only processed entries
log.clear();
// => pending entries remain; processed ones are removed

// --- ContextManager: auto-compress phases as token budget fills ---
const manager = new ContextManager({
  sessionId: 'session-1',
  contextDir: '/tmp/ctx',
  maxTokens: 4000,
  compressionThreshold: 0.7, // compress when 70% of budget is used
  compressFn: async (phase) => {
    // call your LLM here; return a summary string
    return `Tool ${phase.toolCall} produced: ${phase.toolResult.slice(0, 80)}`;
  },
  insightLog: log,
});

const result = await manager.addPhase({
  toolCall: 'read_file("src/index.ts")',
  toolResult: '// file contents ...',
  agentReaction: 'The entry point exports three modules.',
});
// => { tokenCount: 42, compressed: false }

// Force-compress all remaining phases at session end
await manager.flush();
```

## API

| Export                  | Description                                                                                                                            |
| ----------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| `InsightLog`            | In-memory append-only log of `InsightEntry` records                                                                                    |
| `SqliteInsightLog`      | SQLite-backed log; survives process restarts                                                                                           |
| `InsightLogLike`        | Interface implemented by both log classes                                                                                              |
| `InsightEntry`          | Shape of a single log record (`id`, `summary`, `contextFile`, `tags`, `timestamp`, `processed`, `safeToDelete?`)                       |
| `ContextManager`        | Tracks agent phases, estimates token usage, and compresses phases into insights when the budget threshold is reached                   |
| `ContextManagerOptions` | Constructor options for `ContextManager` (`sessionId`, `contextDir`, `maxTokens`, `compressionThreshold?`, `compressFn`, `insightLog`) |
| `CompressFunction`      | `(phase: Phase) => Promise<string>` — pluggable summariser                                                                             |
| `CompressResult`        | Return shape of a compression operation (`compressed`, `insight`)                                                                      |
| `Phase`                 | A single agent turn (`toolCall`, `toolResult`, `agentReaction`)                                                                        |

Full API reference → <!-- link to docs -->

## Related

- [`@neurome/amygdala`](../amygdala/README.md) — scores insights and decides what gets promoted to long-term storage
- [`@neurome/memory`](../memory/README.md) — unified memory facade used by agents
- [`@neurome/ltm`](../ltm/README.md) — long-term memory store that persists promoted insights

## License

MIT
