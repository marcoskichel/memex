#!/usr/bin/env node
import { run } from '../index.js';

const engramId = process.env.NEUROME_ENGRAM_ID;
if (!engramId) {
  process.stderr.write('Error: NEUROME_ENGRAM_ID environment variable is not set.\n');
  process.exit(1);
}

const accessMode = process.env.NEUROME_ACCESS_MODE === 'full' ? 'full' : 'read-only';

try {
  await run(engramId, accessMode);
} catch (error: unknown) {
  process.stderr.write(`Fatal error: ${error instanceof Error ? error.message : String(error)}\n`);
  process.exit(1);
}
