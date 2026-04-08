import { existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { LtmEngine, OpenAIEmbeddingAdapter, SqliteAdapter } from '@neurome/ltm';
import type { LtmRecord } from '@neurome/ltm';

// --- env validation ---
const openaiKey = process.env.OPENAI_API_KEY;
if (!openaiKey) {
  console.error('ERROR: OPENAI_API_KEY must be set');
  process.exit(1);
}

// --- db setup ---
const dbPath = path.join(tmpdir(), `ltm-e2e-${Date.now()}.db`);
if (existsSync(dbPath)) rmSync(dbPath);
console.log(`DB: ${dbPath}\n`);

const storage = new SqliteAdapter(dbPath);
const embeddingAdapter = new OpenAIEmbeddingAdapter({ apiKey: openaiKey });
const eventTarget = new EventTarget();
const ltm = new LtmEngine({ storage, embeddingAdapter, eventTarget });

// --- helpers ---
async function embed(text: string): Promise<Float32Array> {
  const result = await embeddingAdapter.embed(text);
  if (result.isErr()) throw new Error(`Failed to embed "${text}": ${JSON.stringify(result.error)}`);
  return result.value.vector;
}

function daysAgo(n: number): Date {
  return new Date(Date.now() - n * 24 * 60 * 60 * 1000);
}

// --- main ---
async function main(): Promise<void> {
  // -----------------------------------------------
  // Scenario 1: insert + semantic query round-trip
  // -----------------------------------------------
  console.log('[Scenario 1] Insert + semantic query round-trip');
  const id1 = (
    await ltm.insert('Maya Chen is leading the Atlas project at Veridian Technologies.')
  )._unsafeUnwrap();

  const results1 = (
    await ltm.query('Who leads the Atlas initiative?', { strengthen: false })
  )._unsafeUnwrap();
  if (results1.length === 0) throw new Error('Expected at least 1 query result');
  if (!results1.some((r) => r.record.id === id1)) {
    throw new Error(`Record ${String(id1)} not found in query results`);
  }
  console.log(
    `  OK: record ${String(id1)} found (score ${results1[0]?.effectiveScore.toFixed(3)})`,
  );

  // -----------------------------------------------
  // Scenario 2: query specificity
  // -----------------------------------------------
  console.log('\n[Scenario 2] Query specificity — unrelated record not in top result');
  const id2 = (
    await ltm.insert('The weather in Tokyo is sunny today with mild temperatures.')
  )._unsafeUnwrap();

  const results2 = (
    await ltm.query('Who leads the Atlas initiative?', { strengthen: false, limit: 1 })
  )._unsafeUnwrap();
  if (results2.length > 0 && results2[0]?.record.id === id2) {
    throw new Error('Unrelated Tokyo weather record appeared as top result for Atlas query');
  }
  console.log(`  OK: Tokyo weather record (${String(id2)}) not the top result for Atlas query`);

  // -----------------------------------------------
  // Scenario 3: relate + edge assertion
  // -----------------------------------------------
  console.log('\n[Scenario 3] relate() — creates a traversable LTM edge');
  const edgeId = ltm.relate({ fromId: id1, toId: id2, type: 'elaborates' });
  if (edgeId <= 0) throw new Error(`Expected positive edge ID, got ${String(edgeId)}`);
  if (!ltm.getById(id1) || !ltm.getById(id2))
    throw new Error('Records not retrievable after relate');
  console.log(
    `  OK: edge ${String(edgeId)} created between records ${String(id1)} and ${String(id2)}`,
  );

  // -----------------------------------------------
  // Scenario 4: findEntityPath — A→C→B
  // -----------------------------------------------
  console.log('\n[Scenario 4] findEntityPath — path through connected entities (A→C→B)');
  const [embA, embC, embB] = await Promise.all([
    embed('Alice (person)'),
    embed('Cortex project (project)'),
    embed('Bob (person)'),
  ]);
  const entityA = storage.insertEntity({
    name: 'Alice',
    type: 'person',
    embedding: embA,
    createdAt: new Date(),
  });
  const entityC = storage.insertEntity({
    name: 'Cortex',
    type: 'project',
    embedding: embC,
    createdAt: new Date(),
  });
  const entityB = storage.insertEntity({
    name: 'Bob',
    type: 'person',
    embedding: embB,
    createdAt: new Date(),
  });

  storage.insertEntityEdge({
    fromId: entityA,
    toId: entityC,
    type: 'works_on',
    createdAt: new Date(),
  });
  storage.insertEntityEdge({
    fromId: entityC,
    toId: entityB,
    type: 'managed_by',
    createdAt: new Date(),
  });

  const entityPath = ltm.findEntityPath({ fromId: entityA, toId: entityB });
  if (entityPath.length !== 3) {
    throw new Error(
      `Expected path length 3, got ${String(entityPath.length)}: [${entityPath.map((s) => s.entity.name).join(' → ')}]`,
    );
  }
  if (entityPath[0]?.entity.id !== entityA) throw new Error('Path does not start at Alice');
  if (entityPath[1]?.entity.id !== entityC) throw new Error('Path does not pass through Cortex');
  if (entityPath[2]?.entity.id !== entityB) throw new Error('Path does not end at Bob');
  console.log(`  OK: path [${entityPath.map((s) => s.entity.name).join(' → ')}]`);

  // -----------------------------------------------
  // Scenario 5: findEntityPath — empty for unconnected
  // -----------------------------------------------
  console.log('\n[Scenario 5] findEntityPath — empty for unconnected entities');
  const embD = await embed('Diana (person)');
  const entityD = storage.insertEntity({
    name: 'Diana',
    type: 'person',
    embedding: embD,
    createdAt: new Date(),
  });
  const emptyPath = ltm.findEntityPath({ fromId: entityA, toId: entityD });
  if (emptyPath.length !== 0) {
    throw new Error(
      `Expected empty path for unconnected entities, got length ${String(emptyPath.length)}`,
    );
  }
  console.log(`  OK: empty path returned (Diana has no connection to Alice)`);

  // -----------------------------------------------
  // Scenario 6: consolidate — merge into semantic record
  // -----------------------------------------------
  console.log('\n[Scenario 6] consolidate() — merge two episodic records into semantic');
  const id6a = (
    await ltm.insert('Jordan Park joined Veridian as backend engineer.')
  )._unsafeUnwrap();
  const id6b = (
    await ltm.insert('Jordan Park owns the infrastructure roadmap at Veridian.')
  )._unsafeUnwrap();

  const consolidatedId = (
    await ltm.consolidate([id6a, id6b], {
      data: 'Jordan Park is a backend engineer at Veridian who owns the infrastructure roadmap.',
    })
  )._unsafeUnwrap();

  const consolidatedRecord = ltm.getById(consolidatedId);
  if (!consolidatedRecord) throw new Error('Consolidated record not found');
  if ((consolidatedRecord as LtmRecord).tier !== 'semantic') {
    throw new Error(`Expected tier 'semantic', got '${(consolidatedRecord as LtmRecord).tier}'`);
  }

  const consolidatesEdges = storage
    .edgesFrom(consolidatedId)
    .filter((e) => e.type === 'consolidates');
  if (consolidatesEdges.length !== 2) {
    throw new Error(`Expected 2 consolidates edges, got ${String(consolidatesEdges.length)}`);
  }

  const consolidateQueryResults = (
    await ltm.query('Jordan Park infrastructure', { strengthen: false })
  )._unsafeUnwrap();
  if (!consolidateQueryResults.some((r) => r.record.id === consolidatedId)) {
    throw new Error('Consolidated semantic record not found in query results');
  }
  console.log(
    `  OK: consolidated record ${String(consolidatedId)} is semantic, has 2 consolidates edges, and is queryable`,
  );

  // -----------------------------------------------
  // Scenario 7: prune — remove decayed record
  // -----------------------------------------------
  console.log('\n[Scenario 7] prune() — removes record below retention threshold');
  const oldEmbedding = await embed('Ancient conference proceedings from years past');
  const oldRecordId = storage.insertRecord({
    data: 'Ancient conference proceedings from years past',
    metadata: {},
    embedding: oldEmbedding,
    embeddingMeta: { modelId: 'text-embedding-3-small', dimensions: 1536 },
    tier: 'episodic',
    importance: 0,
    stability: 0.5,
    lastAccessedAt: daysAgo(30),
    accessCount: 0,
    createdAt: daysAgo(30),
    tombstoned: false,
    tombstonedAt: undefined,
    engramId: 'ltm-e2e',
  });

  const { pruned } = ltm.prune();
  if (pruned < 1) throw new Error(`Expected at least 1 pruned record, got ${String(pruned)}`);

  const postPruneResults = (
    await ltm.query('ancient conference', { strengthen: false })
  )._unsafeUnwrap();
  if (postPruneResults.some((r) => r.record.id === oldRecordId)) {
    throw new Error('Pruned record still appears in query results');
  }
  console.log(`  OK: prune() removed ${String(pruned)} record(s); old record no longer queryable`);

  // -----------------------------------------------
  // Scenario 8: decay events
  // -----------------------------------------------
  console.log('\n[Scenario 8] Decay event fires for low-retention record');
  const decayEmbedding = await embed('Python programming language fundamentals');
  const decayRecordId = storage.insertRecord({
    data: 'Python programming language fundamentals',
    metadata: {},
    embedding: decayEmbedding,
    embeddingMeta: { modelId: 'text-embedding-3-small', dimensions: 1536 },
    tier: 'episodic',
    importance: 0,
    stability: 0.5,
    lastAccessedAt: daysAgo(10),
    accessCount: 0,
    createdAt: daysAgo(10),
    tombstoned: false,
    tombstonedAt: undefined,
    engramId: 'ltm-e2e',
  });

  let decayFired = false;
  let decayedId: number | undefined;
  eventTarget.addEventListener('ltm:record:decayed-below-threshold', (evt) => {
    decayFired = true;
    decayedId = (evt as CustomEvent<{ id: number; retention: number }>).detail.id;
  });

  (await ltm.query('Python programming language', { strengthen: true }))._unsafeUnwrap();

  if (!decayFired) throw new Error('ltm:record:decayed-below-threshold event was not fired');
  if (decayedId !== decayRecordId) {
    throw new Error(
      `Expected decay event for record ${String(decayRecordId)}, got ${String(decayedId)}`,
    );
  }
  console.log(`  OK: ltm:record:decayed-below-threshold fired for record ${String(decayRecordId)}`);

  // -----------------------------------------------
  // Scenario 9: stats
  // -----------------------------------------------
  console.log('\n[Scenario 9] stats() — reflects operations');
  const stats = ltm.stats();
  if (stats.total <= 0) throw new Error(`Expected total > 0, got ${String(stats.total)}`);
  if (stats.semantic < 1)
    throw new Error(`Expected at least 1 semantic record, got ${String(stats.semantic)}`);
  console.log(
    `  OK: stats = { total: ${String(stats.total)}, episodic: ${String(stats.episodic)}, semantic: ${String(stats.semantic)}, tombstoned: ${String(stats.tombstoned)}, avgRetention: ${stats.avgRetention.toFixed(3)} }`,
  );

  console.log(`\nAll scenarios passed. DB preserved at: ${dbPath}`);
}

main().catch((err: unknown) => {
  console.error('FATAL:', err);
  process.exit(1);
});
