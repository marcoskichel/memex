# memory-biological-fidelity

## What

Four targeted improvements to the Memex memory system, grounded in a neuroscientist review of the implementation against actual biological memory mechanisms. Each change increases fidelity to a specific aspect of human memory without requiring architectural rewrites.

## Why

A neurologist analysis of the codebase (2026-04-06) scored the system at 6.5/10 biological fidelity. The four changes here address the highest-impact, most feasible gaps flagged in that review:

1. **hippocampus-consolidation-api** — The hippocampus runs on a fixed 1-hour clock regardless of agent state. Real consolidation is state-dependent (quiet wakefulness, sleep). Additionally, there is no way for SDK consumers to trigger consolidation manually — useful for testing, end-of-session flushing, and integration scenarios.

2. **false-memory-suppression** — Low-confidence consolidations emit a `hippocampus:false-memory-risk` event but are inserted into LTM anyway. Real hippocampal consolidation is selective; distorted or uncertain summaries should not be promoted without review.

3. **amygdala-agent-state** — The amygdala scoring prompt is static regardless of agent operational state (busy, focused, stressed, idle). Real amygdala salience is modulated by neuromodulatory context. Adding an optional agent state parameter lets callers bias importance scoring for their context.

4. **context-dependent-recall** — Retrieval is purely content-based (cosine similarity). Tulving's encoding specificity principle states that recall succeeds best when retrieval context matches encoding context. Adding context-match weighting to query ranking makes recall more situationally appropriate.

## Scopes

- `packages/hippocampus` — consolidation API trigger + false-memory suppression
- `packages/amygdala` — agent state parameter in scoring prompt
- `packages/cortex` — context-dependent weighting in `getContext`

Cross-cutting: `packages/memory` interface and `packages/cortex` IPC protocol will need minor additions for the consolidation trigger and agent state threading.

## Sequencing

Changes are independent and can ship in any order. `hippocampus-consolidation-api` and `amygdala-agent-state` are highest value. `false-memory-suppression` and `context-dependent-recall` are lower risk and can follow.
