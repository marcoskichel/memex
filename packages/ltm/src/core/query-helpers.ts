import type { LtmQueryResult } from '../ltm-engine-types.js';
import { cosineSimilarity } from './cosine-similarity.js';
import type { RankedCandidate } from './rrf-merge.js';
import { growthFactor, MAX_STABILITY, retention, strengthen } from './stability-manager.js';
import type { LtmEdge, LtmRecord, StorageAdapter } from '../storage/storage-adapter.js';

export const ASSOCIATIVE_SCORE_FACTOR = 0.7;
export const ASSOCIATIVE_RRF_FACTOR = 0.5;
export const SUPERSEDES_RETENTION_THRESHOLD = 0.3;
export const DECAY_THRESHOLD = 0.2;
export const TOP_SEMANTIC_CANDIDATES = 10;

export interface QueryMaps {
  semanticScores: Map<number, number>;
  retentionMap: Map<number, number>;
  recordMap: Map<number, LtmRecord>;
}

export interface RankedLists {
  semanticRanked: RankedCandidate[];
  temporalRanked: RankedCandidate[];
  associativeRanked: RankedCandidate[];
  graphTraversalIds: Set<number>;
}

interface AssociativeContext {
  semanticScores: Map<number, number>;
  temporalScores: Map<number, number>;
  retentionMap: Map<number, number>;
  recordMap: Map<number, LtmRecord>;
  graphTraversalIds: Set<number>;
  storage: StorageAdapter;
}

interface BuildRankedListsParams {
  candidates: LtmRecord[];
  maps: QueryMaps;
  storage: StorageAdapter;
}

interface ApplySupersedesParams {
  recordId: number;
  storage: StorageAdapter;
  shouldStrengthen: boolean;
}

interface StrengthenResultsParams {
  results: LtmQueryResult[];
  graphTraversalIds: Set<number>;
  storage: StorageAdapter;
}

export function buildQueryMaps(candidates: LtmRecord[], queryVector: Float32Array): QueryMaps {
  const semanticScores = new Map<number, number>();
  const retentionMap = new Map<number, number>();
  const recordMap = new Map<number, LtmRecord>();

  for (const record of candidates) {
    const sim = cosineSimilarity(queryVector, record.embedding);
    semanticScores.set(record.id, sim);
    retentionMap.set(record.id, retention(record));
    recordMap.set(record.id, record);
  }

  return { semanticScores, retentionMap, recordMap };
}

export function findLiveRecord(id: number, storage: StorageAdapter): LtmRecord | undefined {
  const record = storage.getById(id);
  if (!record || ('tombstoned' in record && record.tombstoned)) {
    return undefined;
  }
  return record;
}

export function buildRankedLists(params: BuildRankedListsParams): RankedLists {
  const { candidates, maps, storage } = params;
  const { semanticScores, retentionMap, recordMap } = maps;

  const semanticRanked: RankedCandidate[] = [...semanticScores.entries()]
    .toSorted((first, second) => second[1] - first[1])
    .map(([recordId], rank) => ({ recordId, rank: rank + 1 }));

  const temporalScores = buildTemporalScores(candidates, maps);
  const temporalRanked: RankedCandidate[] = [...temporalScores.entries()]
    .toSorted((first, second) => second[1] - first[1])
    .map(([recordId], rank) => ({ recordId, rank: rank + 1 }));

  const context: AssociativeContext = {
    semanticScores,
    temporalScores,
    retentionMap,
    recordMap,
    graphTraversalIds: new Set(),
    storage,
  };
  const { associativeRanked, graphTraversalIds } = buildAssociativeRanked(semanticRanked, context);

  return { semanticRanked, temporalRanked, associativeRanked, graphTraversalIds };
}

function buildTemporalScores(candidates: LtmRecord[], maps: QueryMaps): Map<number, number> {
  const temporalScores = new Map<number, number>();
  for (const record of candidates) {
    temporalScores.set(
      record.id,
      (maps.semanticScores.get(record.id) ?? 0) * (maps.retentionMap.get(record.id) ?? 0),
    );
  }
  return temporalScores;
}

interface AssociativeResult {
  associativeRanked: RankedCandidate[];
  graphTraversalIds: Set<number>;
}

interface EdgeCandidatePair {
  edge: LtmEdge;
  candidate: RankedCandidate;
}

function buildAssociativeRanked(
  semanticRanked: RankedCandidate[],
  context: AssociativeContext,
): AssociativeResult {
  const { semanticScores, graphTraversalIds } = context;
  const associativeRanked: RankedCandidate[] = [];

  for (const candidate of semanticRanked.slice(0, TOP_SEMANTIC_CANDIDATES)) {
    for (const edge of context.storage.edgesFrom(candidate.recordId)) {
      processAssociativeEdge({ edge, candidate }, context);
    }
  }

  for (const id of graphTraversalIds) {
    associativeRanked.push({ recordId: id, rank: associativeRanked.length + 1 });
    if (!semanticScores.has(id)) {
      semanticScores.set(id, context.temporalScores.get(id) ?? 0);
    }
  }

  return { associativeRanked, graphTraversalIds };
}

function processAssociativeEdge(pair: EdgeCandidatePair, context: AssociativeContext): void {
  const { edge, candidate } = pair;
  const { semanticScores, temporalScores, retentionMap, recordMap, graphTraversalIds, storage } =
    context;

  if (edge.type === 'elaborates' || edge.type === 'supersedes' || edge.type === 'consolidates') {
    const targetRecord = recordMap.get(edge.toId) ?? findLiveRecord(edge.toId, storage);
    if (targetRecord && !recordMap.has(edge.toId)) {
      recordMap.set(edge.toId, targetRecord);
      retentionMap.set(edge.toId, retention(targetRecord));
    }
    if (targetRecord) {
      const sourceScore = semanticScores.get(candidate.recordId) ?? 0;
      const assocScore = sourceScore * retention(edge) * ASSOCIATIVE_SCORE_FACTOR;
      temporalScores.set(edge.toId, Math.max(temporalScores.get(edge.toId) ?? 0, assocScore));
      graphTraversalIds.add(edge.toId);
    }
  }
  if (edge.type === 'contradicts') {
    const targetRecord = recordMap.get(edge.toId) ?? findLiveRecord(edge.toId, storage);
    if (targetRecord && !recordMap.has(edge.toId)) {
      recordMap.set(edge.toId, targetRecord);
      retentionMap.set(edge.toId, retention(targetRecord));
    }
    if (targetRecord) {
      graphTraversalIds.add(edge.toId);
    }
  }
}

export function buildStrategyMap(
  rankedLists: RankedLists,
): Map<number, Set<'semantic' | 'temporal' | 'associative'>> {
  const strategyMap = new Map<number, Set<'semantic' | 'temporal' | 'associative'>>();

  for (const candidate of rankedLists.semanticRanked) {
    if (!strategyMap.has(candidate.recordId)) {
      strategyMap.set(candidate.recordId, new Set());
    }
    strategyMap.get(candidate.recordId)?.add('semantic');
  }
  for (const candidate of rankedLists.temporalRanked) {
    if (!strategyMap.has(candidate.recordId)) {
      strategyMap.set(candidate.recordId, new Set());
    }
    strategyMap.get(candidate.recordId)?.add('temporal');
  }
  for (const candidate of rankedLists.associativeRanked) {
    if (!strategyMap.has(candidate.recordId)) {
      strategyMap.set(candidate.recordId, new Set());
    }
    strategyMap.get(candidate.recordId)?.add('associative');
  }

  return strategyMap;
}

export function applySupersedes(params: ApplySupersedesParams): boolean {
  const { recordId, storage, shouldStrengthen } = params;
  const incomingSupersedes = storage.edgesTo(recordId).filter((edge) => edge.type === 'supersedes');
  let isSuperseded = false;
  for (const edge of incomingSupersedes) {
    const edgeRetentionValue = retention(edge);
    if (edgeRetentionValue > SUPERSEDES_RETENTION_THRESHOLD) {
      isSuperseded = true;
    }
    if (shouldStrengthen) {
      const newEdgeStability = Math.min(
        MAX_STABILITY,
        edge.stability * growthFactor(edgeRetentionValue),
      );
      storage.updateEdgeStability(edge.id, {
        stability: newEdgeStability,
        lastAccessedAt: new Date(),
      });
    }
  }
  return isSuperseded;
}

export function strengthenResults(params: StrengthenResultsParams): void {
  const { results, graphTraversalIds, storage } = params;
  const topScore = results[0]?.rrfScore ?? 0;
  for (const result of results) {
    const normalizedRrf = topScore > 0 ? result.rrfScore / topScore : 1;
    const effectiveNormalized = graphTraversalIds.has(result.record.id)
      ? normalizedRrf * ASSOCIATIVE_RRF_FACTOR
      : normalizedRrf;
    const updated = strengthen(result.record, effectiveNormalized);
    storage.updateStability(result.record.id, {
      stability: updated.stability,
      lastAccessedAt: updated.lastAccessedAt,
      accessCount: updated.accessCount,
    });
  }
}

export { clusterEpisodic, filterCandidates, sortResults } from './query-filters.js';
