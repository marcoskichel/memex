import { describe, expect, it } from 'vitest';

import { extractFilters } from '../extract-filters.js';

describe('extractFilters', () => {
  it('extracts amount threshold', () => {
    const { amountThreshold } = extractFilters('show orders above $100');
    expect(amountThreshold).toBe(100);
  });

  it('extracts decimal amount threshold', () => {
    const { amountThreshold } = extractFilters('above $49.99 only');
    expect(amountThreshold).toBeCloseTo(49.99);
  });

  it('is case insensitive for amount', () => {
    const { amountThreshold } = extractFilters('ABOVE $200');
    expect(amountThreshold).toBe(200);
  });

  it('extracts last week time range', () => {
    const before = Date.now();
    const { timeRange } = extractFilters('transactions last week');
    const after = Date.now();

    expect(timeRange).toBeDefined();
    expect(timeRange?.end.getTime()).toBeGreaterThanOrEqual(before);
    expect(timeRange?.end.getTime()).toBeLessThanOrEqual(after);
    const diffMs = (timeRange?.end.getTime() ?? 0) - (timeRange?.start.getTime() ?? 0);
    expect(diffMs).toBeCloseTo(7 * 86_400_000, -3);
  });

  it('is case insensitive for last week', () => {
    const { timeRange } = extractFilters('Last Week activity');
    expect(timeRange).toBeDefined();
  });

  it('returns undefined when no filters match', () => {
    const { amountThreshold, timeRange } = extractFilters('show everything');
    expect(amountThreshold).toBeUndefined();
    expect(timeRange).toBeUndefined();
  });

  it('extracts both filters simultaneously', () => {
    const { amountThreshold, timeRange } = extractFilters('orders above $50 from last week');
    expect(amountThreshold).toBe(50);
    expect(timeRange).toBeDefined();
  });
});
