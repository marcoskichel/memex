import type { EntityNode, LtmRecord } from '@neurome/ltm';

export type EntityType = 'person' | 'project' | 'concept' | 'preference' | 'decision' | 'tool';

export interface ExtractedEntity {
  name: string;
  type: EntityType;
  embedding: Float32Array;
}

export interface ExtractedEdge {
  fromName: string;
  toName: string;
  relationshipType: string;
}

export type EntityResolution =
  | { type: 'exact'; entityId: number; extracted: ExtractedEntity }
  | { type: 'merge'; entityId: number; extracted: ExtractedEntity }
  | { type: 'llm-needed'; candidates: EntityNode[]; extracted: ExtractedEntity }
  | { type: 'distinct'; extracted: ExtractedEntity };

export interface EntityInsertPlan {
  toInsert: ExtractedEntity[];
  toReuse: { extracted: ExtractedEntity; entityId: number }[];
  edgesToInsert: ExtractedEdge[];
  llmNeeded: { extracted: ExtractedEntity; candidates: EntityNode[] }[];
}

export interface ExtractionInput {
  record: LtmRecord;
  prompt: string;
}

export type ExtractionError =
  | { type: 'LLM_CALL_FAILED'; cause: unknown }
  | { type: 'STORAGE_FAILED'; cause: unknown }
  | { type: 'LOCK_FAILED' };
