export type EntityType = 'person' | 'project' | 'concept' | 'preference' | 'decision' | 'tool';

export interface EntityMention {
  name: string;
  type: EntityType;
}

export interface EntityNode {
  id: number;
  name: string;
  type: EntityType;
  embedding: Float32Array;
  createdAt: Date;
}

export interface EntityEdge {
  id: number;
  fromId: number;
  toId: number;
  type: string;
  weight: number;
  createdAt: Date;
}

export interface EntityPathStep {
  entity: EntityNode;
  via: { edgeId: number; type: string; weight: number } | undefined;
}

export interface FindEntityPathParams {
  fromId: number;
  toId: number;
  maxHops?: number;
}
