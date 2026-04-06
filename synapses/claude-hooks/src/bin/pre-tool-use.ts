import { readFileSync } from 'node:fs';

import { AxonClient } from '@neurome/axon';

import { buildHookInsight } from '../core/build-hook-insight.js';
import { parsePreToolUse } from '../core/parse-hook-payload.js';

const GET_CONTEXT_TIMEOUT_MS = 200;

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

const agentName = process.env.MEMORY_AGENT_NAME ?? 'claude';
const insight = buildHookInsight({
  toolName: payload.tool_name,
  input: payload.tool_input,
  sessionId,
  agentName,
});

const axon = new AxonClient(sessionId);

let context = '';

try {
  context = await axon.getContext(
    {
      sessionId,
      toolName: payload.tool_name,
      toolInput: payload.tool_input,
    },
    GET_CONTEXT_TIMEOUT_MS,
  );
  axon.logInsight(insight);
} catch {
  process.exit(0);
}

if (context) {
  process.stdout.write(context);
}

process.exit(0);
