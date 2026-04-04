import { describe, expect, it } from 'vitest';

import { cosineSimilarity } from '../cosine-similarity.js';

describe('cosineSimilarity', () => {
  it('returns 1 for identical vectors', () => {
    const vec = new Float32Array([1, 2, 3]);
    expect(cosineSimilarity(vec, vec)).toBeCloseTo(1);
  });

  it('returns 0 for orthogonal vectors', () => {
    const vecA = new Float32Array([1, 0, 0]);
    const vecB = new Float32Array([0, 1, 0]);
    expect(cosineSimilarity(vecA, vecB)).toBeCloseTo(0);
  });

  it('returns 0 for zero vector', () => {
    const zero = new Float32Array([0, 0, 0]);
    const vec = new Float32Array([1, 2, 3]);
    expect(cosineSimilarity(zero, vec)).toBe(0);
    expect(cosineSimilarity(vec, zero)).toBe(0);
  });

  it('returns -1 for opposite vectors', () => {
    const vecA = new Float32Array([1, 0]);
    const vecB = new Float32Array([-1, 0]);
    expect(cosineSimilarity(vecA, vecB)).toBeCloseTo(-1);
  });
});
