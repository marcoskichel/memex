import { MAX_ENTITY_NEIGHBOR_DEPTH } from './sqlite-schema.js';
import type {
  EntityEdge,
  EntityNode,
  LtmEdge,
  LtmRecord,
  StorageAdapter,
  TombstonedRecord,
  UpdateEdgeStabilityParams,
  UpdateEmbeddingParams,
  UpdateStabilityParams,
} from './storage-adapter.js';
import { cosineSimilarity } from '../core/cosine-similarity.js';

export class InMemoryAdapter implements StorageAdapter {
  private records = new Map<number, LtmRecord & { _deleted?: boolean }>();
  private edges = new Map<number, LtmEdge>();
  private entities = new Map<number, EntityNode>();
  private entityEdges = new Map<number, EntityEdge>();
  private entityRecordLinks = new Map<number, { entityId: number; recordId: number }>();
  private nextRecordId = 1;
  private nextEdgeId = 1;
  private nextEntityId = 1;
  private nextEntityEdgeId = 1;
  private nextEntityRecordLinkId = 1;

  insertRecord(record: Omit<LtmRecord, 'id'>): number {
    const id = this.nextRecordId++;
    this.records.set(id, { ...record, id });
    return id;
  }

  bulkInsertRecords(records: Omit<LtmRecord, 'id'>[]): number[] {
    const ids: number[] = [];
    for (const record of records) {
      ids.push(this.insertRecord(record));
    }
    return ids;
  }

  getById(id: number): LtmRecord | TombstonedRecord | undefined {
    const record = this.records.get(id);
    if (!record) {
      return undefined;
    }
    if (record.tombstoned) {
      return {
        id: record.id,
        tombstoned: true,
        tombstonedAt: record.tombstonedAt ?? new Date(),
        data: undefined,
      };
    }
    return record;
  }

  getAllRecords(): LtmRecord[] {
    const results: LtmRecord[] = [];
    for (const record of this.records.values()) {
      if (!record.tombstoned) {
        results.push(record);
      }
    }
    return results;
  }

  updateMetadata(id: number, patch: Record<string, unknown>): boolean {
    const record = this.records.get(id);
    if (!record || record.tombstoned) {
      return false;
    }
    record.metadata = { ...record.metadata, ...patch };
    return true;
  }

  updateEmbedding(id: number, params: UpdateEmbeddingParams): void {
    const record = this.records.get(id);
    if (!record) {
      return;
    }
    record.embedding = params.embedding;
    record.embeddingMeta = params.meta;
  }

  updateStability(id: number, params: UpdateStabilityParams): void {
    const record = this.records.get(id);
    if (!record) {
      return;
    }
    record.stability = params.stability;
    record.lastAccessedAt = params.lastAccessedAt;
    record.accessCount = params.accessCount;
  }

  tombstoneRecord(id: number): void {
    const record = this.records.get(id);
    if (!record) {
      return;
    }
    record.tombstoned = true;
    record.tombstonedAt = new Date();
    record.data = undefined as unknown as string;
    record.embedding = undefined as unknown as Float32Array;
  }

  countTombstoned(): number {
    let count = 0;
    for (const record of this.records.values()) {
      if (record.tombstoned) {
        count++;
      }
    }
    return count;
  }

  deleteRecord(id: number): boolean {
    const record = this.records.get(id);
    if (!record) {
      return false;
    }
    this.records.delete(id);
    this.deleteEdgesFor(id);
    return true;
  }

  insertEdge(edge: Omit<LtmEdge, 'id'>): number {
    const id = this.nextEdgeId++;
    this.edges.set(id, { ...edge, id });
    return id;
  }

  getEdge(id: number): LtmEdge | undefined {
    return this.edges.get(id);
  }

  edgesFrom(fromId: number): LtmEdge[] {
    const results: LtmEdge[] = [];
    for (const edge of this.edges.values()) {
      if (edge.fromId === fromId) {
        results.push(edge);
      }
    }
    return results;
  }

  edgesTo(toId: number): LtmEdge[] {
    const results: LtmEdge[] = [];
    for (const edge of this.edges.values()) {
      if (edge.toId === toId) {
        results.push(edge);
      }
    }
    return results;
  }

  deleteEdgesFor(recordId: number): void {
    for (const [id, edge] of this.edges.entries()) {
      if (edge.fromId === recordId || edge.toId === recordId) {
        this.edges.delete(id);
      }
    }
  }

  updateEdgeStability(id: number, params: UpdateEdgeStabilityParams): void {
    const edge = this.edges.get(id);
    if (!edge) {
      return;
    }
    edge.stability = params.stability;
    edge.lastAccessedAt = params.lastAccessedAt;
  }

  acquireLock(process: string, ttlMs: number): boolean {
    void process;
    void ttlMs;
    return true;
  }

  releaseLock(process: string): void {
    void process;
  }

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

  insertEntityEdge(edge: Omit<EntityEdge, 'id'>): number {
    const id = this.nextEntityEdgeId++;
    this.entityEdges.set(id, { ...edge, id });
    return id;
  }

  getEntityNeighbors(entityId: number, depth: number): EntityNode[] {
    const clampedDepth = Math.min(Math.max(depth, 1), MAX_ENTITY_NEIGHBOR_DEPTH);
    const visited = new Set<number>();
    const queue: { id: number; depth: number }[] = [{ id: entityId, depth: 0 }];
    visited.add(entityId);

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

  getUnlinkedRecordIds(): number[] {
    const linkedRecordIds = new Set<number>();
    for (const link of this.entityRecordLinks.values()) {
      linkedRecordIds.add(link.recordId);
    }
    const result: number[] = [];
    for (const record of this.records.values()) {
      if (!record.tombstoned && !linkedRecordIds.has(record.id)) {
        result.push(record.id);
      }
    }
    return result;
  }
}
