export interface RankedCandidate {
  recordId: number;
  rank: number;
}

const RRF_K = 60;

export function rrfMerge(rankedLists: RankedCandidate[][]): Map<number, number> {
  const scores = new Map<number, number>();
  for (const list of rankedLists) {
    for (const candidate of list) {
      const current = scores.get(candidate.recordId) ?? 0;
      scores.set(candidate.recordId, current + 1 / (RRF_K + candidate.rank));
    }
  }
  return scores;
}

export { RRF_K };
