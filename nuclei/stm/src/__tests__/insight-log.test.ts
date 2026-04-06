import { beforeEach, describe, expect, it } from 'vitest';

import { InsightLog } from '../insight-log.js';

describe('InsightLog', () => {
  let log: InsightLog;

  beforeEach(() => {
    log = new InsightLog();
  });

  it('append creates entry with id, timestamp, processed=false', () => {
    const entry = log.append({ summary: 'test', contextFile: '/tmp/a.ctx', tags: ['x'] });
    expect(entry.id).toBeTruthy();
    expect(entry.timestamp).toBeInstanceOf(Date);
    expect(entry.processed).toBe(false);
    expect(entry.summary).toBe('test');
    expect(entry.contextFile).toBe('/tmp/a.ctx');
    expect(entry.tags).toEqual(['x']);
  });

  it('append generates unique ids for each entry', () => {
    const first = log.append({ summary: 'a', contextFile: '/tmp/a.ctx', tags: [] });
    const second = log.append({ summary: 'b', contextFile: '/tmp/b.ctx', tags: [] });
    expect(first.id).not.toBe(second.id);
  });

  it('readUnprocessed returns only unprocessed entries in timestamp order', () => {
    const entryA = log.append({ summary: 'a', contextFile: '/tmp/a.ctx', tags: [] });
    const entryB = log.append({ summary: 'b', contextFile: '/tmp/b.ctx', tags: [] });
    const entryC = log.append({ summary: 'c', contextFile: '/tmp/c.ctx', tags: [] });

    log.markProcessed([entryB.id]);

    const unprocessed = log.readUnprocessed();
    expect(unprocessed.map((entry) => entry.id)).toEqual([entryA.id, entryC.id]);
  });

  it('readUnprocessed returns empty array when all are processed', () => {
    const entryA = log.append({ summary: 'a', contextFile: '/tmp/a.ctx', tags: [] });
    log.markProcessed([entryA.id]);
    expect(log.readUnprocessed()).toEqual([]);
  });

  it('markProcessed flips processed flag', () => {
    const entryA = log.append({ summary: 'a', contextFile: '/tmp/a.ctx', tags: [] });
    log.markProcessed([entryA.id]);
    expect(log.readUnprocessed().find((entry) => entry.id === entryA.id)).toBeUndefined();
  });

  it('markProcessed ignores unknown ids without error', () => {
    const entryA = log.append({ summary: 'a', contextFile: '/tmp/a.ctx', tags: [] });
    expect(() => {
      log.markProcessed(['non-existent-id']);
    }).not.toThrow();
    expect(log.readUnprocessed()).toHaveLength(1);
    expect(log.readUnprocessed()[0]?.id).toBe(entryA.id);
  });

  it('clear removes only processed entries, leaves unprocessed', () => {
    const entryA = log.append({ summary: 'a', contextFile: '/tmp/a.ctx', tags: [] });
    const entryB = log.append({ summary: 'b', contextFile: '/tmp/b.ctx', tags: [] });
    log.markProcessed([entryA.id]);

    log.clear();

    const remaining = log.readUnprocessed();
    expect(remaining).toHaveLength(1);
    expect(remaining[0]?.id).toBe(entryB.id);
  });
});
