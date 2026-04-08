import type {
  EmbeddingAdapter,
  EntityNode,
  EntityPathStep,
  LtmEngine,
  LtmQueryResult,
} from '@neurome/ltm';
import { cosineSimilarity } from '@neurome/ltm';
import { okAsync, ResultAsync } from 'neverthrow';

import type { EntityContext, MemoryRecallResult, RecallOptions } from './memory-types.js';
import {
  ENTITY_CONTEXT_TOP_K,
  ENTITY_HINT_SIMILARITY_THRESHOLD,
  ENTITY_PATH_RELIABILITY_THRESHOLD,
} from './memory-types.js';

interface EnrichParams {
  results: LtmQueryResult[];
  queryEmbedding: Float32Array;
  seedEntityIds: number[];
  ltm: LtmEngine;
}

interface FindPathParams {
  seedEntityIds: number[];
  targetId: number;
  ltm: LtmEngine;
}

interface EnrichSingleParams {
  result: LtmQueryResult;
  queryEmbedding: Float32Array;
  seedEntityIds: number[];
  ltm: LtmEngine;
}

export interface SafeEnrichParams {
  results: LtmQueryResult[];
  nlQuery: string;
  options: RecallOptions | undefined;
  embedder: EmbeddingAdapter;
  ltm: LtmEngine;
}

function selectEntity(
  entities: EntityNode[],
  queryEmbedding: Float32Array,
): EntityNode | undefined {
  let best: EntityNode | undefined;
  let bestSim = -Infinity;
  for (const entity of entities) {
    const sim = cosineSimilarity(entity.embedding, queryEmbedding);
    if (sim > bestSim) {
      best = entity;
      bestSim = sim;
    }
  }
  return best;
}

function findShortestPath(
  params: FindPathParams,
): { path: EntityPathStep[]; origin: EntityNode } | undefined {
  const { seedEntityIds, targetId, ltm } = params;
  let shortest: EntityPathStep[] | undefined;
  let origin: EntityNode | undefined;

  for (const fromId of seedEntityIds) {
    const path = ltm.findEntityPath({ fromId, toId: targetId });
    if (path.length > 0 && (!shortest || path.length < shortest.length)) {
      shortest = path;
      origin = path[0]?.entity;
    }
  }

  if (!shortest || !origin) {
    return undefined;
  }
  return { path: shortest, origin };
}

function classifyReliability(path: EntityPathStep[]): 'ok' | 'degraded' {
  return path.length - 1 <= ENTITY_PATH_RELIABILITY_THRESHOLD ? 'ok' : 'degraded';
}

function enrichSingleResult(params: EnrichSingleParams): MemoryRecallResult {
  const { result, queryEmbedding, seedEntityIds, ltm } = params;
  const entities = ltm.getEntitiesForRecord(result.record.id);
  if (entities.length === 0) {
    return result;
  }

  const selectedEntity = selectEntity(entities, queryEmbedding);
  if (!selectedEntity) {
    return result;
  }
  const found =
    seedEntityIds.length > 0
      ? findShortestPath({ seedEntityIds, targetId: selectedEntity.id, ltm })
      : undefined;

  const entityContext: EntityContext = {
    entities,
    selectedEntity,
    originEntity: found?.origin ?? undefined,
    navigationPath: found?.path ?? undefined,
    pathReliability: found ? classifyReliability(found.path) : 'ok',
    entityResolved: true,
  };

  return { ...result, entityContext };
}

export function enrichRecallResults(params: EnrichParams): MemoryRecallResult[] {
  const { results, queryEmbedding, seedEntityIds, ltm } = params;
  const topK = results.slice(0, ENTITY_CONTEXT_TOP_K);
  const rest = results.slice(ENTITY_CONTEXT_TOP_K);
  return [
    ...topK.map((result) => enrichSingleResult({ result, queryEmbedding, seedEntityIds, ltm })),
    ...rest,
  ];
}

export async function resolveHintSeeds(
  hints: string[],
  embedder: EmbeddingAdapter,
): Promise<Float32Array[]> {
  const results = await Promise.all(
    hints.map(async (hint) => {
      const embedResult = await embedder.embed(hint);
      return embedResult.isOk() ? embedResult.value.vector : undefined;
    }),
  );
  return results.filter((vec): vec is Float32Array => vec !== undefined);
}

export function safeEnrich(params: SafeEnrichParams): Promise<MemoryRecallResult[]> {
  const { results, nlQuery, options, embedder, ltm } = params;
  const enrich = (queryEmbedding: Float32Array, seedIds: number[]) =>
    seedIds.length === 0
      ? (results as MemoryRecallResult[])
      : enrichRecallResults({ results, queryEmbedding, seedEntityIds: seedIds, ltm });
  return embedder
    .embed(nlQuery)
    .andThen((embedValue) => {
      const queryEmbedding = embedValue.vector;
      const seedIds = options?.currentEntityIds ?? [];
      if (!options?.currentEntityHint?.length) {
        return okAsync(enrich(queryEmbedding, seedIds));
      }
      return ResultAsync.fromSafePromise(
        resolveHintSeeds(options.currentEntityHint, embedder).then((vecs) => {
          const entities = vecs.flatMap((vec) =>
            ltm.findEntityByEmbedding(vec, ENTITY_HINT_SIMILARITY_THRESHOLD),
          );
          const ids = [...new Set(entities.map((entity) => entity.id))];
          return enrich(queryEmbedding, ids);
        }),
      );
    })
    .unwrapOr(results);
}
