import type { StructuredOutputSchema } from '@neurome/llm';

export interface ConsolidationResult {
  summary: string;
  confidence: number;
  preservedFacts: string[];
  uncertainties: string[];
}

export const SYSTEM_PROMPT = `You are a memory consolidation engine for an AI agent.
You receive a cluster of related episodic memories and produce a single semantic summary.

Rules:
1. Preserve gist, discard episodic detail (who said it, when, exact wording).
2. If facts across episodes are consistent, state them confidently.
3. If facts conflict or seem uncertain, list them in uncertainties — do not fabricate resolution.
4. preservedFacts must be atomic, independently verifiable claims.
5. confidence reflects how consistent and reliable the source episodes are.
6. The summary must be one paragraph, max 3 sentences.`;

export const consolidationSchema: StructuredOutputSchema<ConsolidationResult> = {
  name: 'consolidate_memories',
  description: 'Consolidate a cluster of episodic memories into a semantic summary',
  shape: {
    summary: { type: 'string' },
    confidence: { type: 'number' },
    preservedFacts: { type: 'array', items: { type: 'string' } },
    uncertainties: { type: 'array', items: { type: 'string' } },
  },
  parse: (raw: unknown): ConsolidationResult => {
    const object = raw as Record<string, unknown>;
    if (
      typeof object.summary !== 'string' ||
      typeof object.confidence !== 'number' ||
      !Array.isArray(object.preservedFacts) ||
      !Array.isArray(object.uncertainties)
    ) {
      return { summary: '', confidence: 0, preservedFacts: [], uncertainties: [] };
    }
    return {
      summary: object.summary,
      confidence: object.confidence,
      preservedFacts: object.preservedFacts as string[],
      uncertainties: object.uncertainties as string[],
    };
  },
};
