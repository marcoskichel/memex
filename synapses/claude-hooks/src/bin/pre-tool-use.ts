import { readFileSync } from 'node:fs';

import { formatContext } from '../core/format-context.js';
import { parsePreToolUse } from '../core/parse-hook-payload.js';
import { readContextFiles } from '../shell/clients/context-reader.js';

const CONTEXT_FILE_LIMIT = 3;

function readStdin(): string {
  try {
    return readFileSync('/dev/stdin', 'utf8');
  } catch {
    return '';
  }
}

function main(): void {
  const contextDirectory = process.env.MEMORY_CONTEXT_DIR;

  if (!contextDirectory) {
    process.exit(0);
  }

  const raw = readStdin();
  const payload = parsePreToolUse(raw);
  const sessionId = process.env.MEMORY_SESSION_ID ?? payload?.session_id;

  if (!sessionId) {
    process.exit(0);
  }

  const files = readContextFiles({
    contextDir: contextDirectory,
    sessionId,
    limit: CONTEXT_FILE_LIMIT,
  });
  const output = formatContext(files);

  if (output) {
    process.stdout.write(output);
  }

  process.exit(0);
}

main();
