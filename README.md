# Neurome

The human brain filters, consolidates, and recalls by relevance. AI agents don't — by default. Neurome gives them the same machinery: an amygdala for salience, a hippocampus for consolidation, short-term memory for the present, and long-term memory for the past.

## Overview

Neurome (`@neurome/*`) is a biologically-inspired, persistent memory system for AI agents. It models the human cognitive memory system — working memory, short-term consolidation, long-term storage, and hippocampal integration — as a layered, autonomous pipeline that runs continuously alongside an agent process. By borrowing structure from neuroscience rather than from conventional database design, Neurome gives agents the ability to remember, forget gracefully, and discover relationships across accumulated observations over time.

> For the full system specification, see [docs/SPEC.md](./docs/SPEC.md).

### Component Layout

```
  Agent Process
  +---------------------+        Unix socket
  | @neurome/sdk        |  ----> @neurome/cortex (server process)
  | @neurome/axon       |  <----   |
  | @neurome/afferent   |          |
  | @neurome/dendrite   |          v
  +---------------------+     @neurome/memory  (orchestrator)
                                /    |    \    \
                           stm /  ltm|  amy\  hip\
                              v      v      v      v
                            STM    LTM   Amygdala  Hippocampus
                                    |
                                 SQLite DB
```

### Memory Lifecycle

```
  Agent calls logInsight()
          |
          v
        STM  (InsightLog -- volatile buffer)
          |
          | (polled on cadence)
          v
      Amygdala  -- LLM scores importance
          |
     +----+----+
     |         |
  discard    write to LTM  (episodic record + embedding)
                |
                | (background consolidation)
                v
           Hippocampus  -- clusters episodic records
                |
                v
           LTM semantic record  (durable, cross-engram)
```

## Nuclei

Core packages — compose via `@neurome/memory` or use individually.

| Package                                        | Role                                                                               |
| ---------------------------------------------- | ---------------------------------------------------------------------------------- |
| [`@neurome/memory`](./nuclei/memory)           | Orchestration — unified interface composing all nuclei; start here                 |
| [`@neurome/stm`](./nuclei/stm)                 | Short-term memory — engram-scoped observation buffer                               |
| [`@neurome/ltm`](./nuclei/ltm)                 | Long-term memory — durable semantic store with cross-engram persistence            |
| [`@neurome/amygdala`](./nuclei/amygdala)       | Salience filter — LLM-scores STM observations and routes them to LTM               |
| [`@neurome/hippocampus`](./nuclei/hippocampus) | Consolidation — clusters episodic records and distills them into semantic memories |
| [`@neurome/llm`](./nuclei/llm)                 | LLM adapter — Anthropic and OpenAI-compatible client                               |
| [`@neurome/axon`](./nuclei/axon)               | IPC client — connects to a running cortex server over a Unix socket                |
| [`@neurome/cortex-ipc`](./nuclei/cortex-ipc)   | IPC protocol — shared message types and socket-path convention                     |

## Synapses

Integration adapters that wire Neurome into external systems.

| Package                                          | Role                                                                                 |
| ------------------------------------------------ | ------------------------------------------------------------------------------------ |
| [`@neurome/sdk`](./synapses/sdk)                 | Published SDK — single entry point for app developers; manages cortex lifecycle      |
| [`@neurome/cortex`](./synapses/cortex)           | Memory server — hosts all subsystems in one process, exposes them over a Unix socket |
| [`@neurome/dendrite`](./synapses/dendrite)       | MCP server — exposes memory operations as MCP tools for LLM agents                   |
| [`@neurome/afferent`](./synapses/afferent)       | Event bridge — fire-and-forget observation emitter from agent to cortex              |
| [`@neurome/neurome-tui`](./synapses/neurome-tui) | Terminal dashboard — real-time memory events, stats, and query REPL                  |

## Usage

### `@neurome/sdk`

The SDK is the single published entry point. It spawns and manages cortex as a child process — no manual server setup required.

```bash
npm install @neurome/sdk
```

```ts
import { startEngram } from '@neurome/sdk';

const engram = await startEngram({
  engramId: 'my-agent',
  db: '/var/data/my-agent.db',
  anthropicApiKey: process.env.ANTHROPIC_API_KEY,
  openaiApiKey: process.env.OPENAI_API_KEY,
});

const results = await engram.recall('what did the user prefer?');
engram.logInsight({ summary: 'User prefers concise answers', tags: ['pref'] });

await engram.close();
```

#### MCP integration

`asMcpServer()` returns a config object you can pass directly to the Claude Agent SDK or any MCP client:

```ts
const mcpConfig = engram.asMcpServer();
// => { type: 'stdio', command: 'node', args: [...], env: { NEUROME_ENGRAM_ID: '...', MEMORY_DB_PATH: '...' } }
```

#### Forking for parallel agents

`fork` creates a read-only SQLite snapshot for parallel agent runs. The caller manages the fork lifecycle.

```ts
const forkPath = await engram.fork('/tmp/fork-agent.db');
const forkEngram = await startEngram({ engramId: 'fork-agent', db: forkPath });
```

### Direct / Advanced

For lower-level access, you can use `@neurome/memory` (in-process) or `@neurome/axon` (IPC client) directly. These packages are `private: true` and not published to npm — they're available within the monorepo for contributors and advanced use cases.

```ts
import { createMemory } from '@neurome/memory';
import { OpenAIEmbeddingAdapter } from '@neurome/ltm';

const { memory } = await createMemory({
  storagePath: './neurome.db',
  llmAdapter,
  embeddingAdapter: new OpenAIEmbeddingAdapter({ apiKey: process.env.OPENAI_API_KEY }),
});
```

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
