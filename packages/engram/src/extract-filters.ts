export interface TimeRange {
  start: Date;
  end: Date;
}

export interface QueryFilters {
  amountThreshold: number | undefined;
  timeRange: TimeRange | undefined;
}

const AMOUNT_PATTERN = /above \$([\d.]+)/i;
const LAST_WEEK_PATTERN = /last week/i;
const MS_PER_DAY = 86_400_000;
const DAYS_IN_WEEK = 7;

export function extractFilters(nlQuery: string): QueryFilters {
  const amountMatch = AMOUNT_PATTERN.exec(nlQuery);
  const amountThreshold =
    amountMatch?.[1] === undefined ? undefined : Number.parseFloat(amountMatch[1]);

  const now = new Date();
  const timeRange = LAST_WEEK_PATTERN.test(nlQuery)
    ? { start: new Date(now.getTime() - DAYS_IN_WEEK * MS_PER_DAY), end: now }
    : undefined;

  return { amountThreshold, timeRange };
}
