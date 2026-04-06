# axon-dendrite

## What

Introduce `@memex/axon` as a shared typed IPC client for the cortex daemon, migrate all existing bespoke socket code onto it, and build `@memex/dendrite` — a read-only MCP server that exposes cortex memory operations as tools for AI agents.

## Why

Three problems exist today:

1. **No reusable IPC client.** Every synapse that talks to cortex has written its own socket code. `afferent` has one, `claude-hooks` has another (`cortex-socket-client.ts`). They diverge in reliability: afferent has persistent connection + queuing; claude-hooks has ad-hoc connections with hard-coded timeouts and correlation IDs hardcoded as `"1"`.

2. **No programmatic read API for agents.** Agents can stream events into memory via `afferent`, but there is no package for querying memory (recall, getContext, getRecent, getStats) programmatically from agent code.

3. **No MCP surface.** AI agents that speak MCP have no way to query the memory system via tools. The read operations exist over IPC but are unreachable from the MCP protocol layer.

## Solution

- `packages/axon` — a typed async IPC client covering all cortex operations. Persistent socket, correlation ID tracking, proper error propagation. Used by all synapses.
- `synapses/afferent` — migrated to use `@memex/axon` as its transport. Retains the `AgentEvent` domain abstraction and fire-and-forget queuing.
- `synapses/claude-hooks` — migrated to use `@memex/axon`. Drops `cortex-socket-client.ts`.
- `synapses/dendrite` — new MCP server exposing read-only tools: `recall`, `get_context`, `get_recent`, `get_stats`. Uses `@memex/axon`. Write operations remain `afferent`'s responsibility.

## Naming

- `axon` — the outgoing projection of a neuron. The shared transport through which cortex reaches all consumers.
- `dendrite` — the receiving structure of a neuron. Where agents plug in to receive memory signals. The pair `axon → dendrite` mirrors the biological signal pathway: cortex sends via axon, agents receive via dendrite.

## Scopes

- `packages/axon` — new package
- `synapses/afferent` — migration (drops own socket, wraps axon)
- `synapses/claude-hooks` — migration (drops cortex-socket-client.ts, uses axon)
- `synapses/dendrite` — new synapse

## Sequencing

1. `axon` first — all other scopes depend on it
2. `afferent` and `claude-hooks` in parallel — independent migrations
3. `dendrite` last — depends on axon being stable
