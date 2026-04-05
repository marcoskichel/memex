import { readFileSync } from 'node:fs';

import { parsePreToolUse } from '../core/parse-hook-payload.js';
import { getContext } from '../shell/clients/cortex-socket-client.js';

function readStdin(): string {
  try {
    return readFileSync('/dev/stdin', 'utf8');
  } catch {
    return '';
  }
}

const raw = readStdin();
const payload = parsePreToolUse(raw);
const sessionId = process.env.MEMORY_SESSION_ID ?? payload?.session_id;

if (!sessionId) {
  process.exit(0);
}

if (!payload) {
  process.exit(0);
}

const context = await getContext(
  {
    sessionId,
    toolName: payload.tool_name,
    toolInput: payload.tool_input,
  },
  sessionId,
);

if (context) {
  process.stdout.write(context);
}

process.exit(0);
