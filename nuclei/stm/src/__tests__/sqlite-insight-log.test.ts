import { beforeEach, describe, expect, it } from 'vitest';

import { SqliteInsightLog } from '../storage/sqlite-insight-log.js';

describe('SqliteInsightLog', () => {
  let log: SqliteInsightLog;

  beforeEach(() => {
    log = new SqliteInsightLog(':memory:');
  });

  it('append returns entry with id, timestamp, and processed=false', () => {
    const entry = log.append({ summary: 'test', contextFile: '/tmp/a.ctx', tags: ['x'] });
    expect(entry.id).toBeTruthy();
    expect(entry.timestamp).toBeInstanceOf(Date);
    expect(entry.processed).toBe(false);
    expect(entry.tags).toEqual(['x']);
  });

  it('append round-trips tags as array', () => {
    const entry = log.append({ summary: 'test', contextFile: '/tmp/a.ctx', tags: ['foo', 'bar'] });
    const unprocessed = log.readUnprocessed();
    expect(unprocessed[0]?.id).toBe(entry.id);
    expect(unprocessed[0]?.tags).toEqual(['foo', 'bar']);
  });

  it('readUnprocessed returns only unprocessed rows ordered by timestamp ascending', () => {
    const first = log.append({ summary: 'first', contextFile: '/tmp/a.ctx', tags: [] });
    const second = log.append({ summary: 'second', contextFile: '/tmp/b.ctx', tags: [] });
    const third = log.append({ summary: 'third', contextFile: '/tmp/c.ctx', tags: [] });
    log.markProcessed([second.id]);
    const unprocessed = log.readUnprocessed();
    expect(unprocessed.map((entry) => entry.id)).toEqual([first.id, third.id]);
  });

  it('markProcessed sets flag only on specified ids', () => {
    const first = log.append({ summary: 'first', contextFile: '/tmp/a.ctx', tags: [] });
    const second = log.append({ summary: 'second', contextFile: '/tmp/b.ctx', tags: [] });
    log.markProcessed([first.id]);
    const unprocessed = log.readUnprocessed();
    expect(unprocessed).toHaveLength(1);
    expect(unprocessed[0]?.id).toBe(second.id);
  });

  it('markProcessed is a no-op for unknown ids', () => {
    log.append({ summary: 'first', contextFile: '/tmp/a.ctx', tags: [] });
    expect(() => {
      log.markProcessed(['nonexistent-id']);
    }).not.toThrow();
    expect(log.readUnprocessed()).toHaveLength(1);
  });

  it('clear deletes only processed rows; unprocessed rows survive', () => {
    const first = log.append({ summary: 'first', contextFile: '/tmp/a.ctx', tags: [] });
    const second = log.append({ summary: 'second', contextFile: '/tmp/b.ctx', tags: [] });
    log.markProcessed([first.id]);
    log.clear();
    const remaining = log.allEntries();
    expect(remaining).toHaveLength(1);
    expect(remaining[0]?.id).toBe(second.id);
  });

  it('allEntries returns both processed and unprocessed rows', () => {
    const first = log.append({ summary: 'first', contextFile: '/tmp/a.ctx', tags: [] });
    const second = log.append({ summary: 'second', contextFile: '/tmp/b.ctx', tags: [] });
    log.markProcessed([first.id]);
    const all = log.allEntries();
    expect(all).toHaveLength(2);
    expect(all.map((entry) => entry.id).toSorted()).toEqual([first.id, second.id].toSorted());
  });

  it('safeToDelete round-trips correctly for true, false, and undefined', () => {
    const withTrue = log.append({
      summary: 'with-true',
      contextFile: '/tmp/a.ctx',
      tags: [],
      safeToDelete: true,
    });
    const withFalse = log.append({
      summary: 'with-false',
      contextFile: '/tmp/b.ctx',
      tags: [],
      safeToDelete: false,
    });
    const withUndefined = log.append({
      summary: 'with-undefined',
      contextFile: '/tmp/c.ctx',
      tags: [],
    });

    const all = log.allEntries();
    const findById = (id: string) => all.find((entry) => entry.id === id);

    expect(findById(withTrue.id)?.safeToDelete).toBe(true);
    expect(findById(withFalse.id)?.safeToDelete).toBe(false);
    expect(findById(withUndefined.id)?.safeToDelete).toBeUndefined();
  });

  it('constructing twice does not throw and table creation is idempotent', () => {
    log.append({ summary: 'first', contextFile: '/tmp/a.ctx', tags: [] });
    expect(() => new SqliteInsightLog(':memory:')).not.toThrow();
  });
});
