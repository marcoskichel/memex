## Context

`consolidationPass` in `hippocampus-process.ts` calls `ltm.findConsolidationCandidates` which returns clusters grouped by cosine similarity. Currently, each cluster can span arbitrary time ranges — months or years. Two records about "the user prefers dark mode" from January and July are similar by embedding but represent different temporal snapshots, not a single generalizable fact. Merging them into one semantic record loses the temporal context that makes episodic memory distinct from semantic memory.

The fix is a temporal proximity constraint applied to each cluster before the LLM call: if the spread of `createdAt` across a cluster exceeds a configurable threshold, the cluster is split at its largest consecutive time gap into sub-clusters, each of which is independently gated by `minClusterSize`.

## Goals / Non-Goals

**Goals:**

- Prevent episodic records from different time periods being consolidated together
- Keep split logic O(n log n) per cluster — sort once, scan for largest gap
- Apply constraint before any LLM call to avoid wasted tokens
- Make threshold configurable at the `HippocampusConfig` level (`maxCreatedAtSpreadDays`, default `30`)
- Sub-clusters below `minClusterSize` after splitting are discarded — not promoted individually

**Non-Goals:**

- Recursive splitting (split once at the largest gap only; further temporal fragmentation is left for subsequent consolidation runs as records accumulate)
- Changing the embedding similarity clustering logic in `ltm.findConsolidationCandidates`
- Any changes to other packages

## Decisions

### Split at the single largest gap only

Splitting recursively at every gap above a threshold would complicate the algorithm and could produce many tiny sub-clusters. Splitting once at the largest gap keeps it simple: if a cluster has records from January and July, one split produces two coherent sub-clusters. If after the split a sub-cluster still spans more than the threshold, it will be re-evaluated on the next consolidation run as new records accumulate or as the split sub-clusters themselves age into a fresh state.

### Threshold applies to the full spread, not consecutive pairs

The check is `max(createdAt) - min(createdAt) > threshold`. This is O(n) after sorting and avoids a second pass. Only when the full spread exceeds the threshold is the gap-finding scan needed.

### Sub-clusters below minClusterSize are discarded, not individually promoted

Individually promoting a single episodic record to semantic memory would bypass the importance gating that the amygdala is responsible for. Discarded sub-clusters remain as episodic records and will be re-evaluated on subsequent runs.

### HippocampusConfig owns the default, FindConsolidationOptions reflects it

`HippocampusConfig.maxCreatedAtSpreadDays` (default `30`) is passed through to each `findConsolidationCandidates` call. This allows the constraint to be overridden at config time without changes to the calling code in `consolidationPass`. `FindConsolidationOptions.maxCreatedAtSpreadDays` is the type-level declaration on the LTM side.

## Risks / Trade-offs

- **Aggressive default (30 days)** may discard useful clusters for agents with sparse episodic histories. Callers can raise the threshold or set it to `undefined` to disable — acceptable because the default protects temporal fidelity, which is the primary invariant of episodic memory.
- **Single split per run** means temporally fragmented clusters take multiple runs to fully separate. This is intentional — it bounds complexity per run and avoids cascading splits on stale data.
