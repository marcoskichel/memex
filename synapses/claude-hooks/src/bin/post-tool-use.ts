import { readFileSync } from 'node:fs';

import { parsePostToolUse } from '../core/parse-hook-payload.js';
import { writeContextFile } from '../shell/clients/context-file-writer.js';
import { writeInsight } from '../shell/clients/insight-writer.js';

function readStdin(): string {
  try {
    return readFileSync('/dev/stdin', 'utf8');
  } catch {
    return '';
  }
}

function main(): void {
  const raw = readStdin();
  const payload = parsePostToolUse(raw);

  if (!payload) {
    process.stderr.write('post-tool-use: failed to parse hook payload\n');
    process.exit(0);
  }

  const dbPath = process.env.MEMORY_DB_PATH;
  const contextDirectory = process.env.MEMORY_CONTEXT_DIR;

  if (!dbPath || !contextDirectory) {
    process.stderr.write('post-tool-use: MEMORY_DB_PATH and MEMORY_CONTEXT_DIR are required\n');
    process.exit(0);
  }

  const sessionId = process.env.MEMORY_SESSION_ID ?? payload.session_id;

  const contextFilePath = writeContextFile({ contextDir: contextDirectory, sessionId, payload });
  writeInsight({ dbPath, sessionId, payload, contextFilePath });
  process.exit(0);
}

main();
