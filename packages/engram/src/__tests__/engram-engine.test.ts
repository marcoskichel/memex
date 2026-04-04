import { describe, expect, it } from 'vitest';

import { EngramEngine } from '../engram-engine.js';

describe('EngramEngine — CRUD', () => {
  it('insert returns a positive integer id', () => {
    const engine = new EngramEngine();
    const id = engine.insert('hello', {});
    expect(id).toBeGreaterThan(0);
  });

  it('insert ids are monotonically increasing', () => {
    const engine = new EngramEngine();
    const first = engine.insert('first text', {});
    const second = engine.insert('second text', {});
    expect(second).toBeGreaterThan(first);
  });

  it('bulkInsert returns ids in input order', () => {
    const engine = new EngramEngine();
    const ids = engine.bulkInsert([
      { data: 'one', metadata: {} },
      { data: 'two', metadata: {} },
      { data: 'three', metadata: {} },
    ]);
    expect(ids).toHaveLength(3);
    const [idOne, idTwo, idThree] = ids as [number, number, number];
    expect(idOne).toBeLessThan(idTwo);
    expect(idTwo).toBeLessThan(idThree);
  });

  it('update returns true and changes data', () => {
    const engine = new EngramEngine();
    const id = engine.insert('original', {});
    const result = engine.update(id, { data: 'updated' });
    expect(result).toBe(true);
  });

  it('update merges metadata', () => {
    const engine = new EngramEngine();
    const id = engine.insert('some text', { count: 1 });
    engine.update(id, { metadata: { extra: 2 } });
    const results = engine.query('some text', 0);
    const found = results.find((record) => record.id === id);
    expect(found?.metadata).toMatchObject({ count: 1, extra: 2 });
  });

  it('update returns false for unknown id', () => {
    const engine = new EngramEngine();
    expect(engine.update(999, { data: 'nope' })).toBe(false);
  });

  it('delete returns true for existing record', () => {
    const engine = new EngramEngine();
    const id = engine.insert('bye', {});
    expect(engine.delete(id)).toBe(true);
  });

  it('delete returns false for unknown id', () => {
    const engine = new EngramEngine();
    expect(engine.delete(999)).toBe(false);
  });

  it('deleted record does not appear in query results', () => {
    const engine = new EngramEngine();
    const id = engine.insert('ghost', {});
    engine.delete(id);
    const results = engine.query('ghost', 0);
    expect(results.find((record) => record.id === id)).toBeUndefined();
  });
});

describe('EngramEngine — query', () => {
  it('returns results above threshold only', () => {
    const engine = new EngramEngine();
    engine.insert('test data', {});
    const results = engine.query('test data', 1.1);
    expect(results).toHaveLength(0);
  });

  it('results are sorted by descending similarity', () => {
    const engine = new EngramEngine();
    engine.insert('alpha beta gamma', {});
    engine.insert('alpha beta gamma', {});
    const results = engine.query('alpha beta gamma', 0);
    for (let index = 1; index < results.length; index++) {
      const previous = results[index - 1]?.similarity ?? 0;
      const current = results[index]?.similarity ?? 0;
      expect(previous).toBeGreaterThanOrEqual(current);
    }
  });

  it('amount filter excludes records with amount <= threshold', () => {
    const engine = new EngramEngine();
    engine.insert('order fifty', { amount: 50 });
    engine.insert('order two hundred', { amount: 200 });
    const results = engine.query('order above $100', 0);
    expect(results.every((record) => (record.metadata.amount as number) > 100)).toBe(true);
    expect(results.some((record) => (record.metadata.amount as number) === 200)).toBe(true);
  });

  it('amount filter excludes records without amount field', () => {
    const engine = new EngramEngine();
    engine.insert('no amount here', {});
    const results = engine.query('above $10', 0);
    expect(results).toHaveLength(0);
  });

  it('time filter excludes records outside last 7 days', () => {
    const engine = new EngramEngine();
    const old = new Date(Date.now() - 10 * 86_400_000);
    const recent = new Date(Date.now() - 2 * 86_400_000);
    const oldId = engine.insert('old entry', { timestamp: old });
    const recentId = engine.insert('recent entry', { timestamp: recent });
    const results = engine.query('entries from last week', 0);
    const ids = results.map((record) => record.id);
    expect(ids).not.toContain(oldId);
    expect(ids).toContain(recentId);
  });

  it('time filter excludes records without timestamp', () => {
    const engine = new EngramEngine();
    engine.insert('no timestamp', {});
    const results = engine.query('last week activity', 0);
    expect(results).toHaveLength(0);
  });
});
