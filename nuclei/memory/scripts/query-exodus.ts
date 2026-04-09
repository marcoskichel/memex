import { copyFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { AnthropicAdapter } from '@neurome/llm';
import { OpenAIEmbeddingAdapter } from '@neurome/ltm';
import { createMemory } from '@neurome/memory';
import { InsightLog } from '@neurome/stm';

const anthropicKey = process.env.ANTHROPIC_API_KEY;
const openaiKey = process.env.OPENAI_API_KEY;
if (!anthropicKey || !openaiKey) {
  console.error('ERROR: ANTHROPIC_API_KEY and/or OPENAI_API_KEY must be set');
  process.exit(1);
}

async function query(
  memory: Awaited<ReturnType<typeof createMemory>>['memory'],
  label: string,
  nlQuery: string,
  options?: Parameters<typeof memory.recall>[1],
): Promise<void> {
  console.log(`\n--- ${label} ---`);
  console.log(`Query: "${nlQuery}"${options ? ` opts=${JSON.stringify(options)}` : ''}`);
  const results = (await memory.recall(nlQuery, options))._unsafeUnwrap();
  if (results.length === 0) {
    console.log('  (no results)');
    return;
  }
  for (const [index, result] of results.entries()) {
    const entityContext = result.entityContext
      ? ` [entities: ${result.entityContext.entities.map((e) => e.name).join(', ')}]`
      : '';
    console.log(
      `  [${String(index + 1)}] score=${result.effectiveScore.toFixed(3)}${entityContext}`,
    );
    console.log(`       ${result.record.data.slice(0, 200)}`);
  }
}

async function main(): Promise<void> {
  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  const fixtureSource = path.join(__dirname, 'fixtures', 'exodus-nav.db');
  const dbPath = path.join(tmpdir(), `exodus-query-${Date.now()}.db`);
  copyFileSync(fixtureSource, dbPath);

  const llm = new AnthropicAdapter(anthropicKey!);
  const embeddingAdapter = new OpenAIEmbeddingAdapter({ apiKey: openaiKey! });

  const { memory } = await createMemory({
    storagePath: dbPath,
    llmAdapter: llm,
    embeddingAdapter,
    stm: new InsightLog(),
    amygdalaCadenceMs: 999_999_999,
    hippocampusScheduleMs: 999_999_999,
  });

  const stats = await memory.getStats();
  console.log(
    `Fixture: ltm.totalRecords=${String(stats.ltm.totalRecords)}, perirhinal.entities=${String(stats.perirhinal.entitiesInserted)}`,
  );

  // --- queries ---

  await query(memory, 'plain navigation query', 'how to navigate from assets screen to settings');

  await query(memory, 'plain navigation query (reversed)', 'how to get to settings');

  await query(memory, 'sidebar description', 'what is in the sidebar or profile drawer');

  await query(memory, 'navigation with entity hint: Settings', 'how to navigate to settings', {
    currentEntityHint: ['Settings'],
  });

  await query(memory, 'navigation with entity hint: Profile', 'how to navigate to settings', {
    currentEntityHint: ['Profile'],
  });

  await query(
    memory,
    'navigation with entity hint: Assets + Settings',
    'navigate from assets to settings',
    { currentEntityHint: ['Assets', 'Settings'] },
  );

  await memory.shutdown();
}

main().catch((err: unknown) => {
  console.error('FATAL:', err);
  process.exit(1);
});
