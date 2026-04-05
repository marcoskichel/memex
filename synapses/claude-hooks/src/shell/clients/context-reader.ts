import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';

interface ReadContextFilesOptions {
  contextDir: string;
  sessionId: string;
  limit: number;
}

export function readContextFiles(options: ReadContextFilesOptions): string[] {
  const sessionDirectory = path.join(options.contextDir, options.sessionId);
  if (!existsSync(sessionDirectory)) {
    return [];
  }
  return readdirSync(sessionDirectory)
    .map((name) => ({ name, mtime: statSync(path.join(sessionDirectory, name)).mtimeMs }))
    .toSorted((first, second) => second.mtime - first.mtime)
    .slice(0, options.limit)
    .map(({ name }) => readFileSync(path.join(sessionDirectory, name), 'utf8'));
}
