import { MAX_ENTITY_NEIGHBOR_DEPTH } from './sqlite-schema.js';
import type {
  EntityEdge,
  EntityNode,
  EntityPathStep,
  FindEntityPathParams,
} from './storage-adapter.js';
import { cosineSimilarity } from '../core/cosine-similarity.js';

const MAX_PATH_HOPS = 20;
const DEFAULT_MAX_HOPS = 10;

interface ParentEntry {
  fromId: number;
  edgeId: number;
  type: string;
  weight: number;
}

interface BfsSearch {
  fromId: number;
  toId: number;
  maxHops: number;
}

interface PathBuild {
  fromId: number;
  toId: number;
  parent: Map<number, ParentEntry>;
}

export class InMemoryEntityGraph {
  private entities = new Map<number, EntityNode>();
  private entityEdges = new Map<number, EntityEdge>();
  private entityRecordLinks = new Map<number, { entityId: number; recordId: number }>();
  private nextEntityId = 1;
  private nextEntityEdgeId = 1;
  private nextEntityRecordLinkId = 1;

  insertEntity(entity: Omit<EntityNode, 'id'>): number {
    const id = this.nextEntityId++;
    this.entities.set(id, { ...entity, id });
    return id;
  }

  findEntityByEmbedding(embedding: Float32Array, threshold: number): EntityNode[] {
    const candidates: { entity: EntityNode; similarity: number }[] = [];
    for (const entity of this.entities.values()) {
      const similarity = cosineSimilarity(entity.embedding, embedding);
      if (similarity >= threshold) {
        candidates.push({ entity, similarity });
      }
    }
    candidates.sort((first, second) => second.similarity - first.similarity);
    return candidates.map((candidate) => candidate.entity);
  }

  insertEntityEdge(edge: Omit<EntityEdge, 'id' | 'weight'> & { weight?: number }): number {
    for (const [id, existing] of this.entityEdges) {
      if (
        existing.fromId === edge.fromId &&
        existing.toId === edge.toId &&
        existing.type === edge.type
      ) {
        return id;
      }
    }
    const id = this.nextEntityEdgeId++;
    this.entityEdges.set(id, { ...edge, weight: edge.weight ?? 1, id });
    return id;
  }

  getEntityNeighbors(entityId: number, depth: number): EntityNode[] {
    const clampedDepth = Math.min(Math.max(depth, 1), MAX_ENTITY_NEIGHBOR_DEPTH);
    const visited = new Set<number>([entityId]);
    const queue: { id: number; depth: number }[] = [{ id: entityId, depth: 0 }];

    while (queue.length > 0) {
      const current = queue.shift();
      if (!current || current.depth >= clampedDepth) {
        continue;
      }
      for (const edge of this.entityEdges.values()) {
        if (edge.fromId === current.id && !visited.has(edge.toId)) {
          visited.add(edge.toId);
          queue.push({ id: edge.toId, depth: current.depth + 1 });
        }
      }
    }

    visited.delete(entityId);
    const result: EntityNode[] = [];
    for (const id of visited) {
      const entity = this.entities.get(id);
      if (entity) {
        result.push(entity);
      }
    }
    return result;
  }

  insertEntityRecordLink(entityId: number, recordId: number): number {
    const id = this.nextEntityRecordLinkId++;
    this.entityRecordLinks.set(id, { entityId, recordId });
    return id;
  }

  getUnlinkedRecordIds(allRecordIds: number[]): number[] {
    const linked = new Set<number>();
    for (const link of this.entityRecordLinks.values()) {
      linked.add(link.recordId);
    }
    return allRecordIds.filter((id) => !linked.has(id));
  }

  findEntityPath({
    fromId,
    toId,
    maxHops = DEFAULT_MAX_HOPS,
  }: FindEntityPathParams): EntityPathStep[] {
    const clampedMaxHops = Math.min(Math.max(maxHops, 1), MAX_PATH_HOPS);

    if (fromId === toId) {
      const entity = this.entities.get(fromId);
      if (!entity) {
        return [];
      }
      return [{ entity, via: undefined }];
    }

    const parent = this.runBfs({ fromId, toId, maxHops: clampedMaxHops });
    if (!parent) {
      return [];
    }
    return this.buildPath({ fromId, toId, parent });
  }

  private runBfs({ fromId, toId, maxHops }: BfsSearch): Map<number, ParentEntry> | undefined {
    const visited = new Set<number>([fromId]);
    const parent = new Map<number, ParentEntry>();
    const queue: { id: number; hops: number }[] = [{ id: fromId, hops: 0 }];

    while (queue.length > 0) {
      const current = queue.shift();
      if (!current || current.hops >= maxHops) {
        continue;
      }
      for (const [edgeId, edge] of this.entityEdges) {
        if (edge.fromId !== current.id || visited.has(edge.toId)) {
          continue;
        }
        visited.add(edge.toId);
        parent.set(edge.toId, { fromId: current.id, edgeId, type: edge.type, weight: edge.weight });
        if (edge.toId === toId) {
          return parent;
        }
        queue.push({ id: edge.toId, hops: current.hops + 1 });
      }
    }
    return undefined;
  }

  private buildPath({ fromId, toId, parent }: PathBuild): EntityPathStep[] {
    const pathIds: number[] = [];
    let current = toId;
    while (current !== fromId) {
      pathIds.unshift(current);
      const entry = parent.get(current);
      if (!entry) {
        return [];
      }
      current = entry.fromId;
    }
    pathIds.unshift(fromId);

    return pathIds
      .map((entityId, index) => {
        const entity = this.entities.get(entityId);
        if (!entity) {
          return;
        }
        if (index === 0) {
          return { entity, via: undefined };
        }
        const entry = parent.get(entityId);
        if (!entry) {
          return { entity, via: undefined };
        }
        return { entity, via: { edgeId: entry.edgeId, type: entry.type, weight: entry.weight } };
      })
      .filter((step): step is EntityPathStep => step !== undefined);
  }
}
