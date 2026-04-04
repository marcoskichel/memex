const MIN_STABILITY = 0.5;
const MAX_STABILITY = 365;
const INITIAL_STABILITY_RANGE = 9;
const MS_PER_SECOND = 1000;
const SECONDS_PER_MINUTE = 60;
const MINUTES_PER_HOUR = 60;
const HOURS_PER_DAY = 24;
const MS_PER_DAY = MS_PER_SECOND * SECONDS_PER_MINUTE * MINUTES_PER_HOUR * HOURS_PER_DAY;

export function initialStability(importance: number): number {
  return 1 + importance * INITIAL_STABILITY_RANGE;
}

export function retention(record: { stability: number; lastAccessedAt: Date }): number {
  const ageDays = (Date.now() - record.lastAccessedAt.getTime()) / MS_PER_DAY;
  return Math.exp(-ageDays / record.stability);
}

export function growthFactor(retentionAtRetrieval: number): number {
  return 1 + 2 * (1 - retentionAtRetrieval);
}

export function strengthen(
  record: { stability: number; lastAccessedAt: Date; accessCount: number },
  normalizedRrfScore: number,
): { stability: number; lastAccessedAt: Date; accessCount: number } {
  const retentionValue = retention(record);
  const gf = growthFactor(retentionValue);
  const newStability = Math.min(
    MAX_STABILITY,
    Math.max(MIN_STABILITY, record.stability * gf * normalizedRrfScore),
  );
  return {
    stability: newStability,
    lastAccessedAt: new Date(),
    accessCount: record.accessCount + 1,
  };
}

export { MAX_STABILITY, MIN_STABILITY };
