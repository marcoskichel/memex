import { describe, expect, it } from 'vitest';

import { createEngramEngine, EngramEngine } from '../index.js';

describe('public API smoke test', () => {
  it('createEngramEngine returns an EngramEngine instance', () => {
    const engine = createEngramEngine();
    expect(engine).toBeInstanceOf(EngramEngine);
  });

  it('insert + query round-trip returns the inserted record', () => {
    const engine = createEngramEngine();
    const id = engine.insert('the quick brown fox', {});
    const results = engine.query('quick fox', 0);
    expect(results.some((record) => record.id === id)).toBe(true);
  });

  it('factory with custom options works', () => {
    const engine = createEngramEngine({ vectorDim: 32, maxSeqLen: 20 });
    const id = engine.insert('hello', {});
    expect(id).toBeGreaterThan(0);
  });
});
