## pending-consolidation-review (hippocampus)

Consolidation results with `confidence < LOW_CONFIDENCE_THRESHOLD` SHALL NOT be
inserted into LTM.

Instead, the hippocampus SHALL emit `hippocampus:false-memory-risk` with payload:
`{ pendingId: string; summary: string; confidence: number; sourceIds: number[]; preservedFacts: string[]; uncertainties: string[] }`.

The record SHALL be skipped (not counted as `consolidated`).
