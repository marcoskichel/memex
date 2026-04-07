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
