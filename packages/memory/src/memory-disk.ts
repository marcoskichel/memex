import { readdir, stat, unlink } from 'node:fs/promises';
import path from 'node:path';

import type { InsightLogLike } from '@neurome/stm';

import {
  HOURS_PER_DAY,
  MINUTES_PER_HOUR,
  MS_PER_SECOND,
  SECONDS_PER_MINUTE,
  type PruneContextFilesReport,
} from './memory-types.js';

export interface DiskStats {
  contextFilesOnDisk: number;
  contextTotalBytes: number;
  oldestContextFileAgeMs: number | undefined;
  contextDirectory: string;
}

export async function collectDiskStats(contextDirectory: string): Promise<DiskStats> {
  let contextFilesOnDisk = 0;
  let contextTotalBytes = 0;
  let oldestMtimeMs: number | undefined;

  const entries = await readdir(contextDirectory).catch(() => [] as string[]);
  for (const entry of entries) {
    const fileStat = await stat(path.join(contextDirectory, entry)).catch(() => false as const);
    if (fileStat && fileStat.isFile()) {
      contextFilesOnDisk++;
      contextTotalBytes += fileStat.size;
      if (oldestMtimeMs === undefined || fileStat.mtimeMs < oldestMtimeMs) {
        oldestMtimeMs = fileStat.mtimeMs;
      }
    }
  }

  return {
    contextFilesOnDisk,
    contextTotalBytes,
    oldestContextFileAgeMs: oldestMtimeMs === undefined ? undefined : Date.now() - oldestMtimeMs,
    contextDirectory,
  };
}

export interface PruneContextFilesOptions {
  olderThanDays: number;
}

export async function pruneContextFiles(
  contextDirectory: string,
  { stm, options }: { stm: InsightLogLike; options: PruneContextFilesOptions },
): Promise<PruneContextFilesReport> {
  const cutoffMs =
    options.olderThanDays * HOURS_PER_DAY * SECONDS_PER_MINUTE * MINUTES_PER_HOUR * MS_PER_SECOND;
  const now = Date.now();
  const pendingFiles = new Set(stm.readUnprocessed().map((entry) => entry.contextFile));
  const report: PruneContextFilesReport = {
    deletedCount: 0,
    deletedBytes: 0,
    skippedCount: 0,
    errors: [],
  };

  const entries = await readdir(contextDirectory).catch(() => [] as string[]);

  for (const entry of entries) {
    const filePath = path.join(contextDirectory, entry);
    if (pendingFiles.has(filePath)) {
      report.skippedCount++;
      continue;
    }

    const fileStat = await stat(filePath).catch((error: unknown) => {
      report.errors.push({ path: filePath, error: String(error) });
      return;
    });
    if (fileStat === undefined) {
      continue;
    }

    if (now - fileStat.mtimeMs < cutoffMs) {
      report.skippedCount++;
      continue;
    }

    await unlink(filePath).then(
      () => {
        report.deletedCount++;
        report.deletedBytes += fileStat.size;
      },
      (error: unknown) => {
        report.errors.push({ path: filePath, error: String(error) });
      },
    );
  }

  return report;
}
