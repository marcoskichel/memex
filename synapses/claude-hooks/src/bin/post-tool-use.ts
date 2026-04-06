import { readFileSync } from 'node:fs';

import { AxonClient } from '@neurome/axon';

import { parsePostToolUse } from '../core/parse-hook-payload.js';

const MAX_SUMMARY_RESPONSE_LENGTH = 500;

function readStdin(): string {
  try {
    return readFileSync('/dev/stdin', 'utf8');
  } catch {
    return '';
  }
}

const raw = readStdin();
const payload = parsePostToolUse(raw);

if (!payload) {
  process.stderr.write('post-tool-use: failed to parse hook payload\n');
  process.exit(0);
}

const sessionId = process.env.MEMORY_SESSION_ID ?? payload.session_id;

if (!sessionId) {
  process.exit(0);
}

const axon = new AxonClient(sessionId);

try {
  axon.logInsight({
    summary: `${payload.tool_name}: ${JSON.stringify(payload.tool_response).slice(0, MAX_SUMMARY_RESPONSE_LENGTH)}`,
    contextFile: '',
    tags: [payload.tool_name],
  });
} catch {
  process.exit(0);
}

process.exit(0);
