# Memex

A TypeScript monorepo providing persistent, associative memory infrastructure for AI agents.

## Packages

| Package                    | Description                                                      |
| -------------------------- | ---------------------------------------------------------------- |
| `@memex/stm`               | Short-term memory — session-scoped scratchpad                    |
| `@memex/ltm`               | Long-term memory — semantic store with cross-session persistence |
| `@memex/hippocampus`       | Memory consolidation — promotes STM observations into LTM        |
| `@memex/amygdala`          | Salience filter — decides which memories are worth retaining     |
| `@memex/memory`            | Unified orchestration layer composing all subsystems             |
| `@memex/llm`               | LLM adapter — Anthropic and OpenAI-compatible client             |
| `@memex/cortex`            | CLI entrypoint for running the memory agent                      |
| `@memex/eslint-config`     | Shared ESLint configuration                                      |
| `@memex/typescript-config` | Shared TypeScript configuration                                  |

Synapses (integrations):

| Package               | Description                                              |
| --------------------- | -------------------------------------------------------- |
| `@memex/claude-hooks` | Claude Code hook binaries wiring memory into AI sessions |

## Getting Started

```sh
pnpm install
pnpm build
pnpm test
```

See [NAME.md](./NAME.md) for the etymology of the project name.
