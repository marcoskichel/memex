import type { EntityInsertPlan, EntityResolution, ExtractedEdge } from './types.js';

export function buildEntityInsertPlan(
  resolutions: EntityResolution[],
  edges: ExtractedEdge[],
): EntityInsertPlan {
  const plan: EntityInsertPlan = {
    toInsert: [],
    toReuse: [],
    edgesToInsert: edges,
    llmNeeded: [],
  };

  for (const resolution of resolutions) {
    switch (resolution.type) {
      case 'distinct': {
        plan.toInsert.push(resolution.extracted);
        break;
      }
      case 'exact':
      case 'merge': {
        plan.toReuse.push({ extracted: resolution.extracted, entityId: resolution.entityId });
        break;
      }
      default: {
        plan.llmNeeded.push({ extracted: resolution.extracted, candidates: resolution.candidates });
      }
    }
  }

  return plan;
}
