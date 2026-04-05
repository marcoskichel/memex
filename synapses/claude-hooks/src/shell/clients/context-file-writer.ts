import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';

import type { PostToolUsePayload } from '../../core/parse-hook-payload.js';

const MAX_RESPONSE_LENGTH = 2000;

interface WriteContextFileOptions {
  contextDir: string;
  sessionId: string;
  payload: PostToolUsePayload;
}

export function writeContextFile(options: WriteContextFileOptions): string {
  const sessionDirectory = path.join(options.contextDir, options.sessionId);
  mkdirSync(sessionDirectory, { recursive: true });
  const filename = `${Date.now().toString()}-${options.payload.tool_name}.md`;
  const filePath = path.join(sessionDirectory, filename);
  const content = [
    `# Tool: ${options.payload.tool_name}`,
    '',
    '## Input',
    '',
    '```json',
    JSON.stringify(options.payload.tool_input, undefined, 2),
    '```',
    '',
    '## Response',
    '',
    '```json',
    JSON.stringify(options.payload.tool_response, undefined, 2).slice(0, MAX_RESPONSE_LENGTH),
    '```',
  ].join('\n');
  writeFileSync(filePath, content, 'utf8');
  return filePath;
}
