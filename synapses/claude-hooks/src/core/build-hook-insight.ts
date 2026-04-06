const MAX_INPUT_LENGTH = 500;

export interface HookInsight {
  summary: string;
  contextFile: string;
  tags: string[];
}

export interface BuildHookInsightOptions {
  toolName: string;
  input: Record<string, unknown>;
  sessionId: string;
  agentName?: string;
}

export function buildHookInsight({
  toolName,
  input,
  sessionId,
  agentName = 'claude',
}: BuildHookInsightOptions): HookInsight {
  const serialized = JSON.stringify(input).slice(0, MAX_INPUT_LENGTH);
  return {
    summary: `Tool called: ${toolName} — ${serialized}`,
    contextFile: '',
    tags: ['navigation', `tool:${toolName}`, `agent:${agentName}`, `run:${sessionId}`],
  };
}
