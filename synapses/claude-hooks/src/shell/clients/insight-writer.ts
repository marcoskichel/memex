import { SqliteInsightLog } from '@memex/stm';

import type { PostToolUsePayload } from '../../core/parse-hook-payload.js';

const MAX_SUMMARY_RESPONSE_LENGTH = 500;

interface WriteInsightOptions {
  dbPath: string;
  sessionId: string;
  payload: PostToolUsePayload;
  contextFilePath: string;
}

export function writeInsight(options: WriteInsightOptions): void {
  const log = new SqliteInsightLog(options.dbPath);
  log.append({
    summary: `${options.payload.tool_name}: ${JSON.stringify(options.payload.tool_response).slice(0, MAX_SUMMARY_RESPONSE_LENGTH)}`,
    contextFile: options.contextFilePath,
    tags: [options.payload.tool_name],
    safeToDelete: false,
  });
}
