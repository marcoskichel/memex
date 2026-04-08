import type { EntityType } from '@neurome/entorhinal';

export type { EntityType } from '@neurome/entorhinal';

export type ConsolidateTarget = 'amygdala' | 'hippocampus' | 'all';

export interface AgentProfile {
  type?: string;
  purpose?: string;
}

export interface StartEngramConfig {
  engramId: string;
  db: string;
  source?: string;
  anthropicApiKey?: string;
  openaiApiKey?: string;
  agentProfile?: AgentProfile;
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

type RecallEntityPosition =
  | { currentEntityIds: number[]; currentEntityHint?: never }
  | { currentEntityHint: string[]; currentEntityIds?: never }
  | { currentEntityIds?: never; currentEntityHint?: never };

export interface RecallOptions {
  limit?: number;
  threshold?: number;
  strengthen?: boolean;
  tier?: 'episodic' | 'semantic';
  minImportance?: number;
  after?: Date;
  before?: Date;
  minStability?: number;
  minAccessCount?: number;
  sort?: 'confidence' | 'recency' | 'stability' | 'importance';
  category?: string;
  tags?: string[];
  minResults?: number;
  entityName?: string;
  entityType?: EntityType;
}

export interface RecallParams {
  options?: RecallOptions & RecallEntityPosition;
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
