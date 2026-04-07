# `@neurome/amygdala`

Like its neural namesake, it decides what matters — a background worker that LLM-scores unprocessed STM observations and routes each one to long-term memory as an insert, a relation to an existing memory, or a discard.

Part of the [Neurome](../../README.md) memory infrastructure.

## Install

```sh
pnpm add @neurome/amygdala
```

## Usage

```ts
import { AmygdalaProcess } from '@neurome/amygdala';
import { createLtm } from '@neurome/ltm';
import { InsightLog } from '@neurome/stm';
import { OpenAIAdapter } from '@neurome/llm';

const stm = new InsightLog();
const ltm = createLtm({
  /* your LTM config */
});
const llmAdapter = new OpenAIAdapter({ model: 'gpt-4o-mini' });

const amygdala = new AmygdalaProcess({
  stm,
  ltm,
  llmAdapter,
  sessionId: 'session-abc123',
  cadenceMs: 300_000, // run every 5 min (default)
  maxBatchSize: 10, // entries per cycle (default)
  agentState: 'focused', // raises bar for routine observations
});

amygdala.start();
// => scores unprocessed STM entries on each cycle
// => entries with importanceScore >= 0.7 are promoted to semantic tier
// => entries that fail scoring 3 times are tagged `permanently_skipped`

// Update state at runtime
amygdala.setAgentState('learning');

// Trigger a cycle immediately (e.g. in tests or on-demand flush)
await amygdala.run();

// Shut down cleanly
amygdala.stop();
```

## API

| Export                  | Description                                                                                     |
| ----------------------- | ----------------------------------------------------------------------------------------------- |
| `AmygdalaProcess`       | Background worker class; manages the scoring lifecycle                                          |
| `AmygdalaConfig`        | Constructor config: `ltm`, `stm`, `llmAdapter`, `sessionId` (required); tuning options optional |
| `AmygdalaScoringResult` | LLM decision: `{ action, importanceScore, reasoning, targetId?, edgeType? }`                    |
| `AgentState`            | String type; built-in hints for `'focused'`, `'idle'`, `'stressed'`, `'learning'`               |
| `EventBus`              | Interface for the optional `events` bus passed to config                                        |

### `AmygdalaProcess` methods

| Method                 | Description                                               |
| ---------------------- | --------------------------------------------------------- |
| `start()`              | Starts the cadence interval and the STM threshold watcher |
| `stop()`               | Clears both intervals                                     |
| `run()`                | Runs one scoring cycle immediately (async)                |
| `setAgentState(state)` | Updates the agent state hint fed to the LLM system prompt |

### `AmygdalaScoringResult` shape

| Field             | Type                                            | Description                                        |
| ----------------- | ----------------------------------------------- | -------------------------------------------------- |
| `action`          | `'insert' \| 'relate' \| 'skip'`                | How the entry should be stored                     |
| `importanceScore` | `number` (0–1)                                  | 0.7+ triggers semantic-tier promotion              |
| `reasoning`       | `string`                                        | LLM explanation                                    |
| `targetId`        | `string?`                                       | ID of existing memory (when `action === 'relate'`) |
| `edgeType`        | `'supersedes' \| 'elaborates' \| 'contradicts'` | Relation type (when `action === 'relate'`)         |

### Defaults

| Config key                    | Default                                 |
| ----------------------------- | --------------------------------------- |
| `cadenceMs`                   | `300000` (5 min)                        |
| `maxBatchSize`                | `10`                                    |
| `maxLLMCallsPerHour`          | `200`                                   |
| `lowCostModeThreshold`        | `150` (enters low-cost mode above this) |
| `singletonPromotionThreshold` | `0.7`                                   |

Full API reference → <!-- link to docs -->

## Related

- [`@neurome/stm`](../stm/README.md) — short-term memory store that produces unprocessed observations
- [`@neurome/ltm`](../ltm/README.md) — long-term memory engine that receives scored entries
- [`@neurome/memory`](../memory/README.md) — unified memory facade (STM + LTM + amygdala wired together)
- [`@neurome/llm`](../llm/README.md) — LLM adapter interface used for structured scoring calls

## License

MIT
