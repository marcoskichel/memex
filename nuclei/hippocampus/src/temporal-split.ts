const MS_PER_DAY = 86_400_000;

export function splitByTemporalProximity<T extends { createdAt: Date }>(
  cluster: T[],
  maxSpreadDays: number | undefined,
): T[][] {
  if (maxSpreadDays === undefined || cluster.length === 0) {
    return [cluster];
  }

  const sorted = cluster.toSorted(
    (first, second) => first.createdAt.getTime() - second.createdAt.getTime(),
  );

  const firstMs = sorted.at(0)?.createdAt.getTime() ?? 0;
  const lastMs = sorted.at(-1)?.createdAt.getTime() ?? 0;
  const spreadMs = lastMs - firstMs;

  if (spreadMs <= maxSpreadDays * MS_PER_DAY) {
    return [cluster];
  }

  let largestGap = -1;
  let splitIndex = 0;
  for (let index = 1; index < sorted.length; index++) {
    const current = sorted[index]?.createdAt.getTime() ?? 0;
    const previous = sorted[index - 1]?.createdAt.getTime() ?? 0;
    const gap = current - previous;
    if (gap > largestGap) {
      largestGap = gap;
      splitIndex = index;
    }
  }

  return [sorted.slice(0, splitIndex), sorted.slice(splitIndex)];
}
