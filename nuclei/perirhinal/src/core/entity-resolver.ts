import type { EntityNode } from '@neurome/ltm';
import { cosineSimilarity } from '@neurome/ltm';

import type { EntityResolution, ExtractedEntity } from './types.js';

export const MERGE_THRESHOLD = 0.85;
export const AMBIGUOUS_THRESHOLD = 0.7;

export function resolveEntityIdentity(
  extracted: ExtractedEntity,
  candidates: EntityNode[],
): EntityResolution {
  const normalizedName = extracted.name.toLowerCase();

  const exactMatch = candidates.find(
    (candidate) => candidate.name.toLowerCase() === normalizedName,
  );
  if (exactMatch) {
    return { type: 'exact', entityId: exactMatch.id, extracted };
  }

  const llmNeededCandidates: EntityNode[] = [];

  for (const candidate of candidates) {
    const similarity = cosineSimilarity(extracted.embedding, candidate.embedding);

    if (similarity >= MERGE_THRESHOLD) {
      return { type: 'merge', entityId: candidate.id, extracted };
    } else if (similarity >= AMBIGUOUS_THRESHOLD) {
      llmNeededCandidates.push(candidate);
    }
  }

  if (llmNeededCandidates.length > 0) {
    return { type: 'llm-needed', candidates: llmNeededCandidates, extracted };
  }

  return { type: 'distinct', extracted };
}
