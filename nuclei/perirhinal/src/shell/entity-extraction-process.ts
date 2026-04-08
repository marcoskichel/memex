import type { LLMAdapter } from '@neurome/llm';
import type { LtmRecord, StorageAdapter } from '@neurome/ltm';
import { errAsync, fromThrowable, okAsync, ResultAsync } from 'neverthrow';

import { AMBIGUOUS_THRESHOLD, resolveEntityIdentity } from '../core/entity-resolver.js';
import { buildEntityInsertPlan } from '../core/insert-plan.js';
import { extractEntitiesFromRecord } from '../core/record-extractor.js';
import type {
  EntityInsertPlan,
  EntityResolution,
  ExtractedEdge,
  ExtractedEntity,
  ExtractionError,
} from '../core/types.js';
import type { DeduplicationCandidate } from './clients/extraction-client.js';
import { callDeduplicationLlm, callExtractionLlm } from './clients/extraction-client.js';

const LOCK_NAME = 'entity-extraction';
const LOCK_TTL_MS = 60_000;

export interface EntityExtractionProcessOptions {
  storage: StorageAdapter;
  llm: LLMAdapter;
  embedEntity: (entity: ExtractedEntity) => Promise<Float32Array>;
}

export class EntityExtractionProcess {
  private storage: StorageAdapter;
  private llm: LLMAdapter;
  private embedEntity: (entity: ExtractedEntity) => Promise<Float32Array>;

  constructor(options: EntityExtractionProcessOptions) {
    this.storage = options.storage;
    this.llm = options.llm;
    this.embedEntity = options.embedEntity;
  }

  run(): ResultAsync<void, ExtractionError> {
    if (!this.storage.acquireLock(LOCK_NAME, LOCK_TTL_MS)) {
      return errAsync({ type: 'LOCK_FAILED' as const });
    }

    return this.processUnlinkedRecords().andTee(() => {
      this.storage.releaseLock(LOCK_NAME);
    });
  }

  private processUnlinkedRecords(): ResultAsync<void, ExtractionError> {
    const unlinkedIds = this.storage.getUnlinkedRecordIds();
    const records: LtmRecord[] = [];

    for (const id of unlinkedIds) {
      const record = this.storage.getById(id);
      if (record && !('tombstoned' in record && record.tombstoned)) {
        records.push(record);
      }
    }

    const processable = records.filter((record) => {
      const entities = record.metadata.entities;
      return Array.isArray(entities) && entities.length > 0;
    });

    if (processable.length === 0) {
      return okAsync();
    }

    return ResultAsync.combine(processable.map((record) => this.processRecord(record))).map(() => {
      return;
    });
  }

  private processRecord(record: LtmRecord): ResultAsync<void, ExtractionError> {
    const input = extractEntitiesFromRecord(record);
    if (!input) {
      return okAsync();
    }

    return callExtractionLlm(this.llm, input.prompt)
      .andThen(({ entities, edges }) => this.resolveAndPlan(entities, edges))
      .andThen((plan) => this.executePlan(plan, record.id));
  }

  private resolveAndPlan(
    entities: ExtractedEntity[],
    edges: ExtractedEdge[],
  ): ResultAsync<EntityInsertPlan, ExtractionError> {
    return ResultAsync.fromSafePromise(this.embedAllEntities(entities)).andThen((embedded) => {
      const initialResolutions = embedded.map((entity) => {
        const candidates = this.storage.findEntityByEmbedding(
          entity.embedding,
          AMBIGUOUS_THRESHOLD,
        );
        return resolveEntityIdentity(entity, candidates);
      });

      const hasLlmNeeded = initialResolutions.some(
        (resolution) => resolution.type === 'llm-needed',
      );

      if (!hasLlmNeeded) {
        return okAsync(buildEntityInsertPlan(initialResolutions, edges));
      }

      return this.resolveAmbiguous(initialResolutions, edges);
    });
  }

  private resolveAmbiguous(
    allResolutions: EntityResolution[],
    edges: ExtractedEdge[],
  ): ResultAsync<EntityInsertPlan, ExtractionError> {
    const llmNeededItems = allResolutions.filter(
      (resolution): resolution is EntityResolution & { type: 'llm-needed' } =>
        resolution.type === 'llm-needed',
    );

    const deduplicationCandidates: DeduplicationCandidate[] = llmNeededItems.flatMap(
      (item, index) =>
        item.candidates.map((candidate) => ({
          extractedIndex: index,
          extracted: item.extracted,
          candidateId: candidate.id,
          candidateName: candidate.name,
        })),
    );

    return callDeduplicationLlm(this.llm, deduplicationCandidates).map((decisions) => {
      const finalResolutions = allResolutions.map((resolution) => {
        if (resolution.type !== 'llm-needed') {
          return resolution;
        }

        const llmIndex = llmNeededItems.indexOf(resolution);
        const decision = decisions.get(llmIndex);

        if (decision === 'merge') {
          const firstCandidate = resolution.candidates[0];
          if (firstCandidate) {
            return {
              type: 'merge' as const,
              entityId: firstCandidate.id,
              extracted: resolution.extracted,
            };
          }
        }

        return { type: 'distinct' as const, extracted: resolution.extracted };
      });

      return buildEntityInsertPlan(finalResolutions, edges);
    });
  }

  private async embedAllEntities(entities: ExtractedEntity[]): Promise<ExtractedEntity[]> {
    return Promise.all(
      entities.map(async (entity) => ({
        ...entity,
        embedding: await this.embedEntity(entity),
      })),
    );
  }

  private executePlan(
    plan: EntityInsertPlan,
    recordId: number,
  ): ResultAsync<void, ExtractionError> {
    const safePersist = fromThrowable(
      () => {
        persistInsertPlan(this.storage, { plan, recordId });
      },
      (error): ExtractionError => ({ type: 'STORAGE_FAILED', cause: error }),
    );
    return safePersist().asyncMap(() => Promise.resolve());
  }
}

export function persistInsertPlan(
  storage: StorageAdapter,
  { plan, recordId }: { plan: EntityInsertPlan; recordId: number },
): void {
  const entityIdMap = new Map<string, number>();

  for (const entity of plan.toInsert) {
    const id = storage.insertEntity({
      name: entity.name.toLowerCase(),
      type: entity.type,
      embedding: entity.embedding,
      createdAt: new Date(),
    });
    entityIdMap.set(entity.name.toLowerCase(), id);
    storage.insertEntityRecordLink(id, recordId);
  }

  for (const { extracted, entityId } of plan.toReuse) {
    entityIdMap.set(extracted.name.toLowerCase(), entityId);
    storage.insertEntityRecordLink(entityId, recordId);
  }

  for (const edge of plan.edgesToInsert) {
    const fromId = entityIdMap.get(edge.fromName.toLowerCase());
    const toId = entityIdMap.get(edge.toName.toLowerCase());
    if (fromId !== undefined && toId !== undefined) {
      storage.insertEntityEdge({
        fromId,
        toId,
        type: edge.relationshipType,
        createdAt: new Date(),
      });
    }
  }
}
