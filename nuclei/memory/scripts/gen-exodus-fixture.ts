import { execFileSync } from 'node:child_process';
import { copyFileSync, mkdirSync, rmSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { AnthropicAdapter } from '@neurome/llm';
import { OpenAIEmbeddingAdapter } from '@neurome/ltm';
import { createMemory } from '@neurome/memory';
import { SqliteInsightLog } from '@neurome/stm';

const SOURCE_DB = '/Users/marcoskichel/dev/qa-agents/master/apps/cli/output/memory.db';

const anthropicKey = process.env.ANTHROPIC_API_KEY;
const openaiKey = process.env.OPENAI_API_KEY;
if (!anthropicKey || !openaiKey) {
  console.error('ERROR: ANTHROPIC_API_KEY and/or OPENAI_API_KEY must be set');
  process.exit(1);
}

async function main(): Promise<void> {
  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  const fixturesDir = path.join(__dirname, 'fixtures');
  const outputPath = path.join(fixturesDir, 'exodus-nav.db');

  mkdirSync(fixturesDir, { recursive: true });
  for (const suffix of ['', '-shm', '-wal']) {
    rmSync(outputPath + suffix, { force: true });
  }
  copyFileSync(SOURCE_DB, outputPath);

  const seedSql = [
    'DELETE FROM ltm_records_fts;',
    'DELETE FROM edges;',
    'DELETE FROM entity_record_links;',
    'DELETE FROM entity_edges;',
    'DELETE FROM entities;',
    'DELETE FROM records;',
    "DELETE FROM sqlite_sequence WHERE name = 'records';",
    'DELETE FROM process_locks;',
    'UPDATE insights SET processed = 0;',
    'VACUUM;',
  ].join('\n');
  execFileSync('sqlite3', [outputPath, seedSql]);

  const countOutput = execFileSync('sqlite3', [
    outputPath,
    'SELECT COUNT(*) FROM insights WHERE processed = 0;',
  ])
    .toString()
    .trim();
  const total = parseInt(countOutput, 10);
  console.log(`Fixture seeded: ${String(total)} pending insights\n`);

  const llm = new AnthropicAdapter(anthropicKey!);
  const embeddingAdapter = new OpenAIEmbeddingAdapter({ apiKey: openaiKey! });
  const stm = new SqliteInsightLog(outputPath);

  const { memory } = await createMemory({
    storagePath: outputPath,
    llmAdapter: llm,
    embeddingAdapter,
    stm,
    amygdalaCadenceMs: 999_999_999,
    hippocampusScheduleMs: 999_999_999,
    agentProfile: {
      type: 'qa',
      purpose: 'Explore Exodus mobile wallet UI to identify bugs and navigation issues',
    },
  });

  memory.events.on('amygdala:cycle:end', ({ processed, failures, llmCalls }) => {
    const remaining = stm.readUnprocessed().length;
    console.log(
      `  amygdala:cycle:end — processed=${String(processed)} failures=${String(failures)} llmCalls=${String(llmCalls)} remaining=${String(remaining)}`,
    );
  });

  memory.events.on('perirhinal:extraction:end', ({ stats }) => {
    console.log(
      `  perirhinal:extraction:end — recordsProcessed=${String(stats.recordsProcessed)} entitiesInserted=${String(stats.entitiesInserted)}`,
    );
  });

  let batch = 0;
  while (stm.readUnprocessed().length > 0) {
    batch++;
    console.log(`Batch ${String(batch)}...`);
    await memory.consolidate('amygdala');
    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(
        () => reject(new Error(`perirhinal timed out (batch ${String(batch)})`)),
        120_000,
      );
      memory.events.once('perirhinal:extraction:end', () => {
        clearTimeout(timeout);
        resolve();
      });
    });
  }

  const stats = await memory.getStats();
  console.log(
    `\nDone: ltm.totalRecords=${String(stats.ltm.totalRecords)}, perirhinal.recordsProcessed=${String(stats.perirhinal.recordsProcessed)}, entitiesInserted=${String(stats.perirhinal.entitiesInserted)}`,
  );
  console.log(`Fixture written to: ${outputPath}`);

  await memory.shutdown();
}

main().catch((err: unknown) => {
  console.error('FATAL:', err);
  process.exit(1);
});
