import { promises as fs } from 'node:fs';
import path from 'node:path';

import type { InsightLog } from '@memex/stm';

export async function deleteContextFiles(options: {
  stm?: InsightLog | undefined;
  contextDir?: string | undefined;
}): Promise<number> {
  const { stm, contextDir } = options;
  if (stm) {
    const safeEntries = stm.allEntries().filter((entry) => entry.safeToDelete === true);
    let deleted = 0;
    for (const entry of safeEntries) {
      const unlinked = await fs
        .unlink(entry.contextFile)
        .then(() => true)
        .catch(() => false);
      if (unlinked) {
        deleted++;
      }
    }
    return deleted;
  }
  if (!contextDir) {
    return 0;
  }
  let deleted = 0;
  const sessionDirectories = await fs.readdir(contextDir).catch(() => [] as string[]);
  for (const sessionDirectory of sessionDirectories) {
    const sessionPath = path.join(contextDir, sessionDirectory);
    const files = await fs.readdir(sessionPath).catch(() => [] as string[]);
    for (const file of files) {
      const unlinked = await fs
        .unlink(path.join(sessionPath, file))
        .then(() => true)
        .catch(() => false);
      if (unlinked) {
        deleted++;
      }
    }
  }
  return deleted;
}
