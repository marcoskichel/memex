export interface StartEngramConfig {
  engramId: string;
  db: string;
  source?: string;
  anthropicApiKey?: string;
  openaiApiKey?: string;
}

export interface McpServerConfig {
  type: 'stdio';
  command: string;
  args: string[];
  env: Record<string, string>;
}

export interface RecallResult {
  record: {
    id: number;
    tier: string;
    data: string;
    metadata: unknown;
  };
  effectiveScore: number;
}

export interface RecallParams {
  options?: Record<string, unknown>;
  timeoutMs?: number;
}

export interface InsertMemoryOptions {
  options?: Record<string, unknown>;
  timeoutMs?: number;
}

export interface LogInsightOptions {
  summary: string;
  contextFile: string;
  tags?: string[];
}
