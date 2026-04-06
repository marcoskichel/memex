import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  growthFactor,
  initialStability,
  MAX_STABILITY,
  retention,
  strengthen,
} from '../core/stability-manager.js';

describe('stability-manager', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('initialStability', () => {
    it('returns 1 for importance 0', () => {
      expect(initialStability(0)).toBe(1);
    });

    it('returns 10 for importance 1.0', () => {
      expect(initialStability(1)).toBe(10);
    });

    it('returns 5.5 for importance 0.5', () => {
      expect(initialStability(0.5)).toBe(5.5);
    });
  });

  describe('retention', () => {
    it('returns 1 when lastAccessedAt is now', () => {
      const retentionValue = retention({ stability: 5, lastAccessedAt: new Date() });
      expect(retentionValue).toBeCloseTo(1, 2);
    });

    it('returns e^(-1) when daysSince equals stability', () => {
      const now = Date.now();
      const fiveDaysAgo = new Date(now - 5 * 24 * 60 * 60 * 1000);
      vi.spyOn(Date, 'now').mockReturnValue(now);
      const retentionValue = retention({ stability: 5, lastAccessedAt: fiveDaysAgo });
      expect(retentionValue).toBeCloseTo(Math.exp(-1), 4);
    });

    it('approaches zero for very old records', () => {
      const now = Date.now();
      const veryOld = new Date(now - 365 * 24 * 60 * 60 * 1000);
      vi.spyOn(Date, 'now').mockReturnValue(now);
      const retentionValue = retention({ stability: 1, lastAccessedAt: veryOld });
      expect(retentionValue).toBeGreaterThan(0);
      expect(retentionValue).toBeLessThan(0.001);
    });
  });

  describe('growthFactor', () => {
    it('returns ~1.2 for retention 0.9', () => {
      expect(growthFactor(0.9)).toBeCloseTo(1.2, 5);
    });

    it('returns ~2.4 for retention 0.3', () => {
      expect(growthFactor(0.3)).toBeCloseTo(2.4, 5);
    });

    it('returns 3 for retention 0', () => {
      expect(growthFactor(0)).toBe(3);
    });

    it('returns 1 for retention 1', () => {
      expect(growthFactor(1)).toBe(1);
    });
  });

  describe('strengthen', () => {
    it('increases stability and access count', () => {
      const record = {
        stability: 5,
        lastAccessedAt: new Date(),
        accessCount: 1,
      };
      const result = strengthen(record, 1);
      expect(result.stability).toBeGreaterThanOrEqual(5);
      expect(result.accessCount).toBe(2);
    });

    it('clamps to MAX_STABILITY', () => {
      const record = {
        stability: 300,
        lastAccessedAt: new Date(Date.now() - 200 * 24 * 60 * 60 * 1000),
        accessCount: 100,
      };
      const result = strengthen(record, 1);
      expect(result.stability).toBeLessThanOrEqual(MAX_STABILITY);
    });

    it('scales by normalizedRrfScore', () => {
      const record = {
        stability: 5,
        lastAccessedAt: new Date(),
        accessCount: 0,
      };
      const full = strengthen(record, 1);
      const half = strengthen(record, 0.5);
      expect(full.stability).toBeGreaterThan(half.stability);
    });
  });
});
