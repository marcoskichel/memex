# Neurome

The human brain filters, consolidates, and recalls by relevance. AI agents don't — by default. Neurome gives them the same machinery: an amygdala for salience, a hippocampus for consolidation, short-term memory for the present, and long-term memory for the past.

## Overview

Neurome (`@neurome/*`) is a biologically-inspired, persistent memory system for AI agents. It models the human cognitive memory system — working memory, short-term consolidation, long-term storage, and hippocampal integration — as a layered, autonomous pipeline that runs continuously alongside an agent process. By borrowing structure from neuroscience rather than from conventional database design, Neurome gives agents the ability to remember, forget gracefully, and discover relationships across accumulated observations over time.

> For the full system specification, see [docs/SPEC.md](./docs/SPEC.md).

## Nuclei

Core packages — compose via `@neurome/memory` or use individually.

| Package                                        | Role                                                                               |
| ---------------------------------------------- | ---------------------------------------------------------------------------------- |
| [`@neurome/memory`](./nuclei/memory)           | Orchestration — unified interface composing all nuclei; start here                 |
| [`@neurome/stm`](./nuclei/stm)                 | Short-term memory — session-scoped observation buffer                              |
| [`@neurome/ltm`](./nuclei/ltm)                 | Long-term memory — durable semantic store with cross-session persistence           |
| [`@neurome/amygdala`](./nuclei/amygdala)       | Salience filter — LLM-scores STM observations and routes them to LTM               |
| [`@neurome/hippocampus`](./nuclei/hippocampus) | Consolidation — clusters episodic records and distills them into semantic memories |
| [`@neurome/llm`](./nuclei/llm)                 | LLM adapter — Anthropic and OpenAI-compatible client                               |
| [`@neurome/axon`](./nuclei/axon)               | IPC client — connects to a running cortex server over a Unix socket                |
| [`@neurome/cortex-ipc`](./nuclei/cortex-ipc)   | IPC protocol — shared message types and socket-path convention                     |

## Synapses

Integration adapters that wire Neurome into external systems.

| Package                                          | Role                                                                                 |
| ------------------------------------------------ | ------------------------------------------------------------------------------------ |
| [`@neurome/cortex`](./synapses/cortex)           | Memory server — hosts all subsystems in one process, exposes them over a Unix socket |
| [`@neurome/dendrite`](./synapses/dendrite)       | MCP server — exposes memory operations as MCP tools for LLM agents                   |
| [`@neurome/afferent`](./synapses/afferent)       | Event bridge — fire-and-forget observation emitter from agent to cortex              |
| [`@neurome/neurome-tui`](./synapses/neurome-tui) | Terminal dashboard — real-time memory events, stats, and query REPL                  |

## Usage

### Direct SDK

Embed memory directly in your agent process via `@neurome/memory`:

```ts
import { createMemory } from '@neurome/memory';
import { AnthropicAdapter } from '@neurome/llm';

const { memory } = await createMemory({
  storagePath: './neurome.db',
  llmAdapter: new AnthropicAdapter(process.env.ANTHROPIC_API_KEY),
});

memory.logInsight({ summary: 'User prefers concise answers', tags: ['preference'] });

const results = await memory.recall('response style');
// => [{ record: { data: 'User prefers concise answers', ... }, effectiveScore: 0.94 }]

await memory.shutdown();
```

### Server mode

Run cortex as a long-lived server, connect from any process via `@neurome/axon`:

```sh
MEMORY_DB_PATH=./neurome.db ANTHROPIC_API_KEY=sk-ant-... npx @neurome/cortex
```

```ts
import { AxonClient } from '@neurome/axon';

const axon = new AxonClient(process.env.MEMORY_SESSION_ID);
axon.logInsight({ summary: 'User opened the dashboard', tags: ['navigation'] });

const results = await axon.recall('what did the user do last session');
axon.disconnect();
```

MCP-compatible agents can use `@neurome/dendrite` instead of axon directly — it exposes the same operations as MCP tools over stdio.

## Development

```sh
pnpm install
pnpm build          # build all packages
pnpm test           # run all tests
pnpm check          # lint + typecheck + test
pnpm dev:nuclei     # watch mode for all nuclei
pnpm dev:cortex     # run the cortex server
pnpm dev:tui        # start the terminal UI
```

## License

MIT
