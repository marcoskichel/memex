#!/usr/bin/env node
import { run } from '../index.js';

const sessionId = process.env.MEMEX_SESSION_ID;
if (!sessionId) {
  process.stderr.write('Error: MEMEX_SESSION_ID environment variable is not set.\n');
  process.exit(1);
}

try {
  await run(sessionId);
} catch (error: unknown) {
  process.stderr.write(`Fatal error: ${error instanceof Error ? error.message : String(error)}\n`);
  process.exit(1);
}
