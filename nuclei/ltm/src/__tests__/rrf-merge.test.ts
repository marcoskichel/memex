import { describe, expect, it } from 'vitest';

import { RRF_K, rrfMerge } from '../core/rrf-merge.js';

describe('rrfMerge', () => {
  it('returns empty map for empty input', () => {
    const result = rrfMerge([]);
    expect(result.size).toBe(0);
  });

  it('scores a single list correctly', () => {
    const result = rrfMerge([
      [
        { recordId: 1, rank: 1 },
        { recordId: 2, rank: 2 },
      ],
    ]);
    expect(result.get(1)).toBeCloseTo(1 / (RRF_K + 1), 10);
    expect(result.get(2)).toBeCloseTo(1 / (RRF_K + 2), 10);
  });

  it('records in multiple lists rank higher', () => {
    const result = rrfMerge([
      [
        { recordId: 1, rank: 1 },
        { recordId: 2, rank: 2 },
      ],
      [
        { recordId: 1, rank: 1 },
        { recordId: 3, rank: 2 },
      ],
    ]);
    const score1 = result.get(1);
    const score2 = result.get(2);
    const score3 = result.get(3);
    if (score1 === undefined || score2 === undefined || score3 === undefined) {
      throw new Error('expected scores');
    }
    expect(score1).toBeGreaterThan(score2);
    expect(score1).toBeGreaterThan(score3);
    expect(score1).toBeCloseTo(2 / (RRF_K + 1), 10);
  });

  it('handles three lists', () => {
    const result = rrfMerge([
      [{ recordId: 1, rank: 1 }],
      [{ recordId: 1, rank: 2 }],
      [{ recordId: 1, rank: 3 }],
    ]);
    const expected = 1 / (RRF_K + 1) + 1 / (RRF_K + 2) + 1 / (RRF_K + 3);
    expect(result.get(1)).toBeCloseTo(expected, 10);
  });
});
