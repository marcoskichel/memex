import type { LLMAdapter, StructuredOutputSchema } from '@neurome/llm';
import type { ResultAsync } from 'neverthrow';

import type { ExtractedEdge, ExtractedEntity, ExtractionError } from '../../core/types.js';

interface ExtractionOutput {
  entities?: { name: string; type: string }[];
  edges?: { fromName: string; toName: string; relationshipType: string }[];
}

interface DeduplicationOutput {
  results: { index: number; decision: 'merge' | 'distinct'; candidateId: number }[];
}

const EXTRACTION_SCHEMA: StructuredOutputSchema<ExtractionOutput> = {
  name: 'entity_extraction',
  description: 'Extract entity nodes and relationship edges from a memory record.',
  shape: {
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
        required: ['name', 'type'],
      },
    },
    edges: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          fromName: { type: 'string' },
          toName: { type: 'string' },
          relationshipType: { type: 'string' },
        },
        required: ['fromName', 'toName', 'relationshipType'],
      },
    },
  },
  parse: (raw) => raw as ExtractionOutput,
};

const DEDUPLICATION_SCHEMA: StructuredOutputSchema<DeduplicationOutput> = {
  name: 'entity_deduplication',
  description: 'Determine whether extracted entities are the same as existing candidates.',
  shape: {
    results: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          index: { type: 'number' },
          decision: { type: 'string', enum: ['merge', 'distinct'] },
          candidateId: { type: 'number' },
        },
        required: ['index', 'decision', 'candidateId'],
      },
    },
  },
  parse: (raw) => raw as DeduplicationOutput,
};

export function callExtractionLlm(
  llm: LLMAdapter,
  prompt: string,
): ResultAsync<{ entities: ExtractedEntity[]; edges: ExtractedEdge[] }, ExtractionError> {
  return llm
    .completeStructured<ExtractionOutput>({ prompt, schema: EXTRACTION_SCHEMA })
    .map((output) => ({
      entities: (output.entities ?? []).map((entity) => ({
        name: entity.name,
        type: entity.type as ExtractedEntity['type'],
        embedding: new Float32Array(0),
      })),
      edges: (output.edges ?? []).map((edge) => ({
        fromName: edge.fromName,
        toName: edge.toName,
        relationshipType: edge.relationshipType,
      })),
    }))
    .mapErr((error) => ({ type: 'LLM_CALL_FAILED' as const, cause: error }));
}

export interface DeduplicationCandidate {
  extractedIndex: number;
  extracted: ExtractedEntity;
  candidateId: number;
  candidateName: string;
}

export function callDeduplicationLlm(
  llm: LLMAdapter,
  candidates: DeduplicationCandidate[],
): ResultAsync<Map<number, 'merge' | 'distinct'>, ExtractionError> {
  const pairDescriptions = candidates
    .map(
      (item, index) =>
        `[${String(index)}] Extracted: "${item.extracted.name}" (${item.extracted.type}) | Existing: "${item.candidateName}" (id: ${String(item.candidateId)})`,
    )
    .join('\n');

  const prompt = `For each pair below, decide if the extracted entity is the same as the existing entity ("merge") or different ("distinct").

Pairs:
${pairDescriptions}

Return a result for each pair index.`;

  return llm
    .completeStructured<DeduplicationOutput>({ prompt, schema: DEDUPLICATION_SCHEMA })
    .map((output) => {
      const decisions = new Map<number, 'merge' | 'distinct'>();
      for (const result of output.results) {
        decisions.set(result.index, result.decision);
      }
      return decisions;
    })
    .mapErr((error) => ({ type: 'LLM_CALL_FAILED' as const, cause: error }));
}
