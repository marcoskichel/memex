import { readFile } from 'node:fs/promises';

import type { StructuredOutputSchema } from '@neurome/llm';
import type { EntityMention } from '@neurome/ltm';

export interface StorageWithLock {
  acquireLock?: (p: string, ttl: number) => boolean;
  releaseLock?: (p: string) => void;
}

export interface LtmWithStorage {
  storage: StorageWithLock;
}

const MINUTES_PER_CADENCE = 5;
const SECONDS_PER_MINUTE = 60;
export const MS_PER_SECOND = 1000;
export const DEFAULT_CADENCE_MS = MINUTES_PER_CADENCE * SECONDS_PER_MINUTE * MS_PER_SECOND;
export const DEFAULT_MAX_BATCH_SIZE = 10;
export const DEFAULT_MAX_LLM_CALLS_PER_HOUR = 200;
export const DEFAULT_LOW_COST_MODE_THRESHOLD = 150;
export const STM_THRESHOLD = 10;
export const RETRY_DELAY_FIRST_MS = 500;
export const RETRY_DELAY_SECOND_MS = 2000;
export const RETRY_DELAYS_MS = [RETRY_DELAY_FIRST_MS, RETRY_DELAY_SECOND_MS];
export const MAX_CONSECUTIVE_FAILURES = 3;
export const CONTEXT_EXCERPT_LENGTH = 200;
export const MAX_RELATED_MEMORIES = 3;
export const LOW_COST_MAX_RELATED = 1;
export const ESTIMATED_TOKENS_PER_CALL = 500;
export const THRESHOLD_CHECK_INTERVAL_MS = 5000;
export const DEFAULT_SINGLETON_PROMOTION_THRESHOLD = 0.7;
export const INTERNAL_TAGS = ['permanently_skipped', 'llm_rate_limited'];
const MINUTES_PER_HOUR = 60;
export const HOUR_MS = SECONDS_PER_MINUTE * MINUTES_PER_HOUR * MS_PER_SECOND;

export async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function readContextExcerpt(contextFile: string): Promise<string | undefined> {
  const failed = Symbol('failed');
  const content = await readFile(contextFile, 'utf8').catch(() => failed);
  return content === failed ? undefined : (content as string).slice(0, CONTEXT_EXCERPT_LENGTH);
}

export const SYSTEM_PROMPT = `You are the amygdala of a cognitive memory system. Your role is to classify new observations and decide how they should be stored in long-term memory.

For each observation, you must:
1. Assess its importance (0.0 = trivial, 1.0 = critical)
2. Determine the appropriate action:
   - insert: Store as a new, independent memory
   - relate: Store and link to an existing related memory
   - skip: Discard (too trivial, duplicate, or noise)
3. If relating, specify the edge type:
   - elaborates: Adds detail to existing memory
   - supersedes: Replaces or updates existing memory
   - contradicts: Conflicts with existing memory
4. Extract named entities mentioned in the observation. Use these types:
   - person: named individuals (e.g. "Alice", "the CEO")
   - project: software projects, products, or initiatives (e.g. "Neurome", "Project X")
   - concept: technical or domain topics (e.g. "vector embeddings", "consolidation")
   - preference: explicit preferences (e.g. "prefers TypeScript", "avoids ORMs")
   - decision: explicit choices made (e.g. "decided to use SQLite")
   - tool: software tools, libraries, or services (e.g. "pnpm", "Anthropic API")

Do NOT extract: bare pronouns (it, they, this), abstract nouns (system, process, thing), temporal expressions (today, last week), generic verbs or adjectives.

Be conservative with importance scores. Most observations are 0.1-0.4. Reserve 0.7+ for genuinely significant information.`;

export type AgentState = string;

const AGENT_STATE_HINTS: Record<string, string> = {
  focused: 'Agent is focused on a task — raise bar for routine/distraction observations.',
  idle: 'Agent is idle — score normally.',
  stressed: 'Agent is under stress — lower threshold for high-importance items.',
  learning: 'Agent is in learning mode — raise importance for novel/unexpected observations.',
};

export function buildSystemPrompt(agentState?: AgentState): string {
  if (!agentState) {
    return SYSTEM_PROMPT;
  }
  const hint = AGENT_STATE_HINTS[agentState] ?? `Agent state: ${agentState}.`;
  return `${SYSTEM_PROMPT}\n\nCurrent agent state: ${hint}`;
}

export interface AmygdalaScoringResult {
  action: 'insert' | 'relate' | 'skip';
  targetId?: string;
  edgeType?: 'supersedes' | 'elaborates' | 'contradicts';
  reasoning: string;
  importanceScore: number;
  entities: EntityMention[];
}

export interface EntryOutcome {
  processed: number;
  failures: number;
  llmCalls: number;
}

export interface EventBus {
  emit(event: string, payload?: unknown): unknown;
  on(event: string, listener: (...arguments_: unknown[]) => void): unknown;
}

const VALID_ENTITY_TYPES = new Set([
  'person',
  'project',
  'concept',
  'preference',
  'decision',
  'tool',
]);

function parseEntities(raw: unknown): EntityMention[] {
  if (!Array.isArray(raw)) {
    return [];
  }
  const result: EntityMention[] = [];
  for (const item of raw) {
    if (typeof item === 'object' && item !== null) {
      const { name, type } = item as Record<string, unknown>;
      if (typeof name === 'string' && typeof type === 'string' && VALID_ENTITY_TYPES.has(type)) {
        result.push({ name, type: type as EntityMention['type'] });
      }
    }
  }
  return result;
}

export const amygdalaScoringSchema: StructuredOutputSchema<AmygdalaScoringResult> = {
  name: 'score_observation',
  description: 'Classify a new observation for memory storage and extract named entities',
  shape: {
    action: { type: 'string', enum: ['insert', 'relate', 'skip'] },
    targetId: { type: 'string' },
    edgeType: { type: 'string', enum: ['supersedes', 'elaborates', 'contradicts'] },
    reasoning: { type: 'string' },
    importanceScore: { type: 'number' },
    entities: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          type: {
            type: 'string',
            enum: ['person', 'project', 'concept', 'preference', 'decision', 'tool'],
          },
        },
      },
    },
  },
  parse: (raw: unknown): AmygdalaScoringResult => {
    const object = raw as Record<string, unknown>;
    const action = object.action as 'insert' | 'relate' | 'skip';
    if (!['insert', 'relate', 'skip'].includes(action)) {
      return { action: 'skip', reasoning: '', importanceScore: 0, entities: [] };
    }
    const rawScore = Number(object.importanceScore);
    const importanceScore = Number.isNaN(rawScore) ? 0 : Math.max(0, Math.min(1, rawScore));
    const result: AmygdalaScoringResult = {
      action,
      importanceScore,
      reasoning: typeof object.reasoning === 'string' ? object.reasoning : '',
      entities: parseEntities(object.entities),
    };
    if (typeof object.targetId === 'string') {
      result.targetId = object.targetId;
    }
    if (object.edgeType) {
      const edgeType = object.edgeType as 'supersedes' | 'elaborates' | 'contradicts';
      if (['supersedes', 'elaborates', 'contradicts'].includes(edgeType)) {
        result.edgeType = edgeType;
      }
    }
    return result;
  },
};

export interface PromptWithContext {
  summary: string;
  contextExcerpt: string;
  relatedMemories: { data: string; id: number }[];
}

export function buildPrompt(
  summary: string,
  relatedMemories: { data: string; id: number }[],
): string {
  const lines: string[] = [`Observation: ${summary}`];
  if (relatedMemories.length > 0) {
    lines.push('\nRelated existing memories:');
    for (const mem of relatedMemories) {
      lines.push(`- [id:${mem.id.toString()}] ${mem.data}`);
    }
  }
  lines.push(
    '\nClassify this observation and determine how it should be stored in long-term memory.',
  );
  return lines.join('\n');
}

export function buildPromptWithContext(options: PromptWithContext): string {
  const base = buildPrompt(options.summary, options.relatedMemories);
  const contextLine = `\nContext excerpt:\n${options.contextExcerpt}`;
  const observationEnd = base.indexOf('\n');
  return base.slice(0, observationEnd) + contextLine + base.slice(observationEnd);
}
