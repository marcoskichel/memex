import { existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { AnthropicAdapter } from '@neurome/llm';
import { cosineSimilarity, OpenAIEmbeddingAdapter, SqliteAdapter } from '@neurome/ltm';
import type { EntityType, LtmRecord, StorageAdapter } from '@neurome/ltm';
import type Database from 'better-sqlite3';

import type { ExtractedEntity } from '../src/core/types.js';
import { EntityExtractionProcess } from '../src/shell/entity-extraction-process.js';

// --- env validation ---
const anthropicKey = process.env.ANTHROPIC_API_KEY;
const openaiKey = process.env.OPENAI_API_KEY;
if (!anthropicKey || !openaiKey) {
  console.error('ERROR: ANTHROPIC_API_KEY and/or OPENAI_API_KEY must be set');
  process.exit(1);
}

// --- db setup ---
const dbPath = path.join(tmpdir(), `perirhinal-e2e-${Date.now()}.db`);
if (existsSync(dbPath)) rmSync(dbPath);
console.log(`DB: ${dbPath}\n`);

const storage = new SqliteAdapter(dbPath);
const llm = new AnthropicAdapter(anthropicKey);
const embeddingAdapter = new OpenAIEmbeddingAdapter({ apiKey: openaiKey });

// --- fixtures ---
function makeRecord(
  data: string,
  entities: { name: string; type: EntityType }[],
): Omit<LtmRecord, 'id'> {
  return {
    data,
    metadata: { entities },
    embedding: new Float32Array(1536),
    embeddingMeta: { modelId: 'text-embedding-3-small', dimensions: 1536 },
    tier: 'episodic',
    importance: 0.5,
    stability: 1,
    lastAccessedAt: new Date(),
    accessCount: 0,
    createdAt: new Date(),
    tombstoned: false,
    tombstonedAt: undefined,
    engramId: 'veridian-e2e',
  };
}

async function embedEntity(entity: ExtractedEntity): Promise<Float32Array> {
  const text = `${entity.name} (${entity.type})`;
  const result = await embeddingAdapter.embed(text);
  if (result.isErr()) throw new Error(`Failed to embed "${text}": ${result.error.type}`);
  return result.value.vector;
}

async function embedText(text: string): Promise<Float32Array> {
  const result = await embeddingAdapter.embed(text);
  if (result.isErr()) throw new Error(`Failed to embed "${text}": ${result.error.type}`);
  return result.value.vector;
}

// Access SqliteAdapter's internal db to avoid WAL visibility issues
// from a separate better-sqlite3 instance.
function storageDb(): Database.Database {
  return (storage as unknown as { db: Database.Database }).db;
}

function countEntities(): number {
  return (storageDb().prepare('SELECT COUNT(*) as n FROM entities').get() as { n: number }).n;
}

function printGraphState(): void {
  const db = storageDb();
  {
    const entities = db.prepare('SELECT id, name, type FROM entities ORDER BY id').all() as {
      id: number;
      name: string;
      type: string;
    }[];
    const edges = db.prepare('SELECT from_id, to_id, type FROM entity_edges ORDER BY id').all() as {
      from_id: number;
      to_id: number;
      type: string;
    }[];
    const links = db
      .prepare('SELECT entity_id, record_id FROM entity_record_links ORDER BY id')
      .all() as { entity_id: number; record_id: number }[];

    const entityMap = new Map(entities.map((e) => [e.id, `${e.name} (${e.type})`]));

    console.log(`\n=== GRAPH STATE ===`);
    console.log(`Nodes (${entities.length}):`);
    for (const entity of entities) {
      console.log(`  [${entity.id}] ${entity.name} (${entity.type})`);
    }
    console.log(`\nEdges (${edges.length}):`);
    for (const edge of edges) {
      const from = entityMap.get(edge.from_id) ?? `#${String(edge.from_id)}`;
      const to = entityMap.get(edge.to_id) ?? `#${String(edge.to_id)}`;
      console.log(`  ${from} -> ${to} [${edge.type}]`);
    }
    console.log(`\nRecord links (${links.length}):`);
    for (const link of links) {
      const entityLabel = entityMap.get(link.entity_id) ?? `#${String(link.entity_id)}`;
      console.log(`  record ${String(link.record_id)} -> ${entityLabel}`);
    }
  }
}

function assertNoUnlinked(s: StorageAdapter): void {
  const unlinked = s.getUnlinkedRecordIds();
  if (unlinked.length > 0) {
    throw new Error(
      `Assertion failed: ${String(unlinked.length)} unlinked record(s): [${unlinked.join(', ')}]`,
    );
  }
}

function makeProcess(): EntityExtractionProcess {
  return new EntityExtractionProcess({ storage, llm, embedEntity });
}

function assertOk(result: { isErr(): boolean; error?: unknown }, label: string): void {
  if (result.isErr()) {
    throw new Error(`${label} failed: ${JSON.stringify(result.error)}`);
  }
}

// --- main ---
async function main(): Promise<void> {
  const proc = makeProcess();

  // ----------------------------------------------------------------
  // Scenario 1: Maya Chen + Jordan Park + Atlas — baseline insertion
  // ----------------------------------------------------------------
  console.log('[Scenario 1] Maya Chen + Jordan Park + Atlas — baseline insertion');
  const before1 = countEntities();
  const record1Id = storage.insertRecord(
    makeRecord(
      'Maya Chen and Jordan Park met to discuss Q1 priorities for the Atlas project at Veridian. Maya is leading Atlas; Jordan will own backend infrastructure.',
      [
        { name: 'Maya Chen', type: 'person' },
        { name: 'Jordan Park', type: 'person' },
        { name: 'Atlas', type: 'project' },
      ],
    ),
  );
  const result1 = await proc.run();
  assertOk(result1, 'Scenario 1');
  const new1 = countEntities() - before1;
  console.log(`  New nodes: ${String(new1)}`);
  if (new1 !== 3) console.warn(`  WARN: expected 3 new nodes (LLM may have extracted differently)`);
  if (storage.getUnlinkedRecordIds().includes(record1Id))
    throw new Error(`Record ${String(record1Id)} still unlinked`);
  console.log(`  OK: record ${String(record1Id)} linked`);

  // ----------------------------------------------------------------
  // Scenario 2: Jordan Park + Atlas again — exact deduplication
  // ----------------------------------------------------------------
  console.log('\n[Scenario 2] Jordan Park + Atlas again — exact dedup');
  const before2 = countEntities();
  const record2Id = storage.insertRecord(
    makeRecord(
      'Jordan Park shared the Q2 roadmap for the Atlas project with the Veridian team during the all-hands.',
      [
        { name: 'Jordan Park', type: 'person' },
        { name: 'Atlas', type: 'project' },
      ],
    ),
  );
  const result2 = await proc.run();
  assertOk(result2, 'Scenario 2');
  const new2 = countEntities() - before2;
  console.log(`  New nodes: ${String(new2)} (expected 0)`);
  if (new2 !== 0)
    console.warn(`  WARN: expected 0 new nodes but got ${String(new2)} — check dedup log`);
  if (storage.getUnlinkedRecordIds().includes(record2Id))
    throw new Error(`Record ${String(record2Id)} still unlinked`);
  console.log(`  OK: record ${String(record2Id)} linked`);

  // ----------------------------------------------------------------
  // Scenario 3: Sasha Novak + Atlas + TypeScript — partial dedup
  // ----------------------------------------------------------------
  console.log('\n[Scenario 3] Sasha Novak + Atlas + TypeScript — partial dedup');
  const before3 = countEntities();
  const record3Id = storage.insertRecord(
    makeRecord(
      'Sasha Novak joined Veridian and will build the Atlas frontend using TypeScript. Atlas team welcomed Sasha.',
      [
        { name: 'Sasha Novak', type: 'person' },
        { name: 'Atlas', type: 'project' },
        { name: 'TypeScript', type: 'tool' },
      ],
    ),
  );
  const result3 = await proc.run();
  assertOk(result3, 'Scenario 3');
  const new3 = countEntities() - before3;
  console.log(`  New nodes: ${String(new3)} (expected 2: Sasha Novak + TypeScript)`);
  if (new3 !== 2)
    console.warn(`  WARN: expected 2 new nodes (Atlas should be reused) but got ${String(new3)}`);
  if (storage.getUnlinkedRecordIds().includes(record3Id))
    throw new Error(`Record ${String(record3Id)} still unlinked`);
  console.log(`  OK: record ${String(record3Id)} linked`);

  // ----------------------------------------------------------------
  // Scenario 4: Lena + PostgreSQL + Redis + Cortex — multi-entity
  // ----------------------------------------------------------------
  console.log('\n[Scenario 4] Lena Muller + PostgreSQL + Redis + Cortex — multi-entity');
  const before4 = countEntities();
  const record4Id = storage.insertRecord(
    makeRecord(
      'Lena Muller presented a comparison of PostgreSQL versus Redis for the Cortex data layer at the Veridian architecture review.',
      [
        { name: 'Lena Muller', type: 'person' },
        { name: 'PostgreSQL', type: 'tool' },
        { name: 'Redis', type: 'tool' },
        { name: 'Cortex', type: 'project' },
      ],
    ),
  );
  const result4 = await proc.run();
  assertOk(result4, 'Scenario 4');
  const new4 = countEntities() - before4;
  console.log(`  New nodes: ${String(new4)} (expected 4)`);
  if (new4 !== 4) console.warn(`  WARN: expected 4 new nodes but got ${String(new4)}`);
  if (storage.getUnlinkedRecordIds().includes(record4Id))
    throw new Error(`Record ${String(record4Id)} still unlinked`);
  console.log(`  OK: record ${String(record4Id)} linked`);
  printGraphState();

  // ----------------------------------------------------------------
  // Scenario 5: "Postgres" (tool) — dedup probe vs "PostgreSQL"
  // ----------------------------------------------------------------
  console.log('\n[Scenario 5] "Postgres" (tool) — dedup probe vs "PostgreSQL"');
  const postgresVec = await embedText('Postgres (tool)');
  const postgresqlVec = await embedText('PostgreSQL (tool)');
  const cosine5 = cosineSimilarity(postgresVec, postgresqlVec);
  console.log(`  cosine("Postgres (tool)", "PostgreSQL (tool)") = ${cosine5.toFixed(4)}`);

  const before5 = countEntities();
  const record5Id = storage.insertRecord(
    makeRecord(
      'Maya Chen confirmed that Postgres is now the primary database for the Atlas project at Veridian.',
      [
        { name: 'Maya Chen', type: 'person' },
        { name: 'Postgres', type: 'tool' },
        { name: 'Atlas', type: 'project' },
      ],
    ),
  );
  const result5 = await proc.run();
  assertOk(result5, 'Scenario 5');
  const new5 = countEntities() - before5;
  const resolution5 =
    new5 === 0
      ? 'exact/merge (reused PostgreSQL)'
      : `distinct (inserted as new node, count +${String(new5)})`;
  console.log(`  Resolution for "Postgres": ${resolution5}`);
  if (storage.getUnlinkedRecordIds().includes(record5Id))
    throw new Error(`Record ${String(record5Id)} still unlinked`);
  console.log(`  OK: record ${String(record5Id)} linked`);

  // ----------------------------------------------------------------
  // Scenario 6a: "RAG" (concept) — insert fresh
  // ----------------------------------------------------------------
  console.log('\n[Scenario 6a] "RAG" (concept) — fresh insert');
  const before6a = countEntities();
  const record6aId = storage.insertRecord(
    makeRecord(
      'The Veridian team discussed using RAG to improve Atlas memory retrieval performance.',
      [
        { name: 'RAG', type: 'concept' },
        { name: 'Atlas', type: 'project' },
      ],
    ),
  );
  const result6a = await proc.run();
  assertOk(result6a, 'Scenario 6a');
  const new6a = countEntities() - before6a;
  console.log(`  New nodes: ${String(new6a)} (expected 1: RAG)`);
  if (new6a !== 1) console.warn(`  WARN: expected 1 new node (RAG) but got ${String(new6a)}`);
  if (storage.getUnlinkedRecordIds().includes(record6aId))
    throw new Error(`Record ${String(record6aId)} still unlinked`);
  console.log(`  OK: record ${String(record6aId)} linked`);

  // ----------------------------------------------------------------
  // Scenario 6b: "retrieval-augmented generation" — dedup probe vs "RAG"
  // ----------------------------------------------------------------
  console.log('\n[Scenario 6b] "retrieval-augmented generation" — dedup probe vs "RAG"');
  const ragVec = await embedText('RAG (concept)');
  const ragFullVec = await embedText('retrieval-augmented generation (concept)');
  const cosine6 = cosineSimilarity(ragVec, ragFullVec);
  console.log(
    `  cosine("RAG (concept)", "retrieval-augmented generation (concept)") = ${cosine6.toFixed(4)}`,
  );

  const before6b = countEntities();
  const record6bId = storage.insertRecord(
    makeRecord(
      'Maya Chen wrote a design document on retrieval-augmented generation for the Cortex service at Veridian.',
      [
        { name: 'retrieval-augmented generation', type: 'concept' },
        { name: 'Maya Chen', type: 'person' },
        { name: 'Cortex', type: 'project' },
      ],
    ),
  );
  const result6b = await proc.run();
  assertOk(result6b, 'Scenario 6b');
  const new6b = countEntities() - before6b;
  const resolution6b =
    new6b === 0
      ? 'exact/merge (reused RAG)'
      : `distinct (inserted as new node, count +${String(new6b)})`;
  console.log(`  Resolution for "retrieval-augmented generation": ${resolution6b}`);
  if (storage.getUnlinkedRecordIds().includes(record6bId))
    throw new Error(`Record ${String(record6bId)} still unlinked`);
  console.log(`  OK: record ${String(record6bId)} linked`);

  // ----------------------------------------------------------------
  // Scenario 7: Jordan + Lena + Cortex + TypeScript — edges-only
  // ----------------------------------------------------------------
  console.log('\n[Scenario 7] Jordan Park + Lena Muller + Cortex + TypeScript — edges-only');
  const before7 = countEntities();
  const record7Id = storage.insertRecord(
    makeRecord(
      'Jordan Park and Lena Muller aligned on using TypeScript for the Cortex API at the Veridian offsite.',
      [
        { name: 'Jordan Park', type: 'person' },
        { name: 'Lena Muller', type: 'person' },
        { name: 'TypeScript', type: 'tool' },
        { name: 'Cortex', type: 'project' },
      ],
    ),
  );
  const result7 = await proc.run();
  assertOk(result7, 'Scenario 7');
  const new7 = countEntities() - before7;
  console.log(`  New nodes: ${String(new7)} (expected 0 — all entities already exist)`);
  if (new7 !== 0) console.warn(`  WARN: expected 0 new nodes but got ${String(new7)}`);
  if (storage.getUnlinkedRecordIds().includes(record7Id))
    throw new Error(`Record ${String(record7Id)} still unlinked`);
  console.log(`  OK: record ${String(record7Id)} linked`);
  printGraphState();

  // ----------------------------------------------------------------
  // Scenario 8: Dr. Isabel Reyes — isolated new node, no edges to existing graph
  // ----------------------------------------------------------------
  console.log('\n[Scenario 8] Dr. Isabel Reyes — isolated new node');
  const before8 = countEntities();
  const preExistingIds = new Set<number>(
    (storageDb().prepare('SELECT id FROM entities').all() as { id: number }[]).map((r) => r.id),
  );
  const record8Id = storage.insertRecord(
    makeRecord('Dr. Isabel Reyes presented her research findings at an international conference.', [
      { name: 'Dr. Isabel Reyes', type: 'person' },
    ]),
  );
  const result8 = await proc.run();
  assertOk(result8, 'Scenario 8');
  const new8 = countEntities() - before8;
  if (new8 < 1) throw new Error(`Expected at least 1 new node (Dr. Isabel Reyes), got 0`);
  if (new8 > 1)
    console.warn(
      `  WARN: expected 1 new node but got ${String(new8)} (LLM extracted extra entities)`,
    );
  console.log(`  New nodes: ${String(new8)} (Dr. Isabel Reyes + ${String(new8 - 1)} extras)`);

  const drReyesNode = storage.findEntityByEmbedding(
    await embedText('Dr. Isabel Reyes (person)'),
    0.9,
  );
  if (drReyesNode.length === 0) throw new Error('Dr. Isabel Reyes node not found by embedding');
  const drReyesId = drReyesNode[0]!.id;
  const drReyesNeighbors = storage.getEntityNeighbors(drReyesId, 2);
  const drReyesNeighborsInExistingGraph = drReyesNeighbors.filter((n) => preExistingIds.has(n.id));
  if (drReyesNeighborsInExistingGraph.length !== 0)
    throw new Error(
      `Expected no connections to existing graph for Dr. Isabel Reyes, got ${String(drReyesNeighborsInExistingGraph.length)}: ${drReyesNeighborsInExistingGraph.map((n) => n.name).join(', ')}`,
    );
  console.log(`  OK: Dr. Isabel Reyes has no connections to pre-existing entities`);

  if (storage.getUnlinkedRecordIds().includes(record8Id))
    throw new Error(`Record ${String(record8Id)} still unlinked`);
  console.log(`  OK: record ${String(record8Id)} linked`);

  // ----------------------------------------------------------------
  // Lock contention test
  // ----------------------------------------------------------------
  console.log('\n[Lock contention] Manually acquire lock, run process');
  storage.acquireLock('entity-extraction', 60_000);
  const lockResult = await makeProcess().run();
  if (!lockResult.isErr() || lockResult.error.type !== 'LOCK_FAILED')
    throw new Error(`Expected LOCK_FAILED, got: ${JSON.stringify(lockResult)}`);
  console.log(`  OK: process returned LOCK_FAILED as expected`);
  storage.releaseLock('entity-extraction');

  // ----------------------------------------------------------------
  // Final pass: process any remaining unlinked records
  // ----------------------------------------------------------------
  console.log('\n[Final pass] Running process on remaining unlinked records');
  const finalResult = await proc.run();
  assertOk(finalResult, 'Final pass');
  assertNoUnlinked(storage);
  console.log('  OK: getUnlinkedRecordIds() is empty');

  // ----------------------------------------------------------------
  // Final graph dump
  // ----------------------------------------------------------------
  console.log('\n[Final graph dump]');
  printGraphState();

  const mayaNode = storage.findEntityByEmbedding(await embedText('Maya Chen (person)'), 0.9);
  if (mayaNode.length > 0) {
    const mayaId = mayaNode[0]!.id;
    const mayaNeighbors = storage.getEntityNeighbors(mayaId, 2);
    console.log(
      `\nDepth-2 neighbors of Maya Chen (id=${String(mayaId)}): [${mayaNeighbors.map((n) => n.name).join(', ')}]`,
    );
  }

  console.log(`\nDB preserved at: ${dbPath}`);
}

main().catch((err: unknown) => {
  console.error('FATAL:', err);
  process.exit(1);
});
