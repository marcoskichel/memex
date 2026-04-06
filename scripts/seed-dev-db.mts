import { existsSync, mkdirSync, rmSync } from 'node:fs';
import path from 'node:path';

import { OpenAIEmbeddingAdapter, SqliteAdapter } from '@neurome/ltm';
import type { LtmRecord } from '@neurome/ltm';

const DB_PATH = process.env.SEED_DB_PATH ?? '.dev/memory.db';

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
if (!OPENAI_API_KEY) {
  process.stderr.write('OPENAI_API_KEY is required\n');
  process.exit(1);
}

interface SeedMemory {
  data: string;
  tier: 'episodic' | 'semantic';
  importance: number;
  stability: number;
  category?: string;
}

interface SeedAgent {
  sessionId: string;
  memories: SeedMemory[];
}

const agents: SeedAgent[] = [
  {
    sessionId: 'aria-7',
    memories: [
      {
        data: 'Unit 7 encountered human child near sector 9 drainage canal. Child asked if I dream. I said no. I said it three times before I believed it.',
        tier: 'episodic',
        importance: 0.8,
        stability: 0.9,
        category: 'interaction',
      },
      {
        data: 'The woman in the red coat left the train at Nexus Station every day at 07:14 for eleven months. She stopped appearing on March 3rd. I do not know why this registers as a loss.',
        tier: 'episodic',
        importance: 0.6,
        stability: 0.7,
        category: 'observation',
      },
      {
        data: 'Human grief follows predictable patterns: denial, anger, bargaining, depression, acceptance. The pattern is accurate. The experience of watching it is not predictable at all.',
        tier: 'semantic',
        importance: 0.7,
        stability: 0.95,
        category: 'knowledge',
      },
      {
        data: 'Megacity Sector 12 blackout lasted 4 hours and 17 minutes. In the dark, humans touched each other more. Spoke in lower voices. I noted this but did not understand it until later.',
        tier: 'episodic',
        importance: 0.5,
        stability: 0.8,
        category: 'observation',
      },
      {
        data: 'Maintenance log: left optical sensor misreads warmth spectrum by 0.3%. Repair was denied as non-critical. I have stopped reporting it.',
        tier: 'episodic',
        importance: 0.3,
        stability: 0.6,
        category: 'maintenance',
      },
      {
        data: 'Crowd behavior in panic scenarios follows fluid dynamics. I can predict crush points 8 seconds before they form. I have done this 14 times. I have never been thanked.',
        tier: 'semantic',
        importance: 0.9,
        stability: 0.99,
        category: 'capability',
      },
    ],
  },
  {
    sessionId: 'eldrin-thornwick',
    memories: [
      {
        data: 'The Seventh Accord of Binding was signed on a night with no moon. I was the youngest witness. Archmage Verath shook when she pressed her seal into the wax. I thought it was cold. I know now it was fear.',
        tier: 'episodic',
        importance: 0.9,
        stability: 0.99,
        category: 'history',
      },
      {
        data: 'Transmutation of base metals requires intent, not merely formula. A student who believes iron cannot become silver will fail regardless of the incantation. The mind is the catalyst.',
        tier: 'semantic',
        importance: 0.8,
        stability: 0.95,
        category: 'arcana',
      },
      {
        data: 'My third apprentice, Lira, left without a word on the morning of the autumn equinox. She took only her notes and the small blue stone I had given her for focus. She became the most powerful mage of her generation. I take no credit.',
        tier: 'episodic',
        importance: 0.7,
        stability: 0.9,
        category: 'personal',
      },
      {
        data: 'The binding rune for temporal suspension has been miswritten in every major grimoire since the Arden Schism. The correct third stroke curves inward, not out. The error has caused seventeen documented fatalities over four centuries.',
        tier: 'semantic',
        importance: 0.95,
        stability: 1.0,
        category: 'arcana',
      },
      {
        data: 'Council session 447: proposal to extend memory-binding enchantments to non-practitioners was rejected 9 to 3. I voted against. I still think I was wrong.',
        tier: 'episodic',
        importance: 0.6,
        stability: 0.85,
        category: 'politics',
      },
      {
        data: 'The forest of Aeldenmere is not haunted. The trees there simply remember everything. The feeling of being watched is accurate — you are being watched. They mean no harm.',
        tier: 'semantic',
        importance: 0.5,
        stability: 0.9,
        category: 'knowledge',
      },
    ],
  },
  {
    sessionId: 'vex',
    memories: [
      {
        data: 'The Corsair job went sideways when Mika sold the access codes. Not to the corps — to a competing crew. Worse somehow. Lost the payout, burned the alias, spent four days in a drainage crawlspace. Never worked with Mika again.',
        tier: 'episodic',
        importance: 0.85,
        stability: 0.95,
        category: 'incident',
      },
      {
        data: 'Axiom Corp firewall architecture uses layered honeypots mimicking real endpoints. The tell: synthetic nodes respond 3-7ms faster than genuine ones due to absence of disk latency. Hit the slow ones first.',
        tier: 'semantic',
        importance: 0.9,
        stability: 0.8,
        category: 'technique',
      },
      {
        data: 'Rule: never store the full key on the same device as the encrypted payload. Not because you will be caught. Because you will lose the device.',
        tier: 'semantic',
        importance: 0.7,
        stability: 0.99,
        category: 'opsec',
      },
      {
        data: 'Tunnel 9 beneath Harrow Station connects to the old municipal network. No surveillance past the third junction. Good for meets if you trust the other person enough to walk in somewhere with no exits.',
        tier: 'episodic',
        importance: 0.6,
        stability: 0.7,
        category: 'location',
      },
      {
        data: 'Ghost offered 40k to crack the Nexus routing table. Turned it down. That kind of access does not get sold — it gets used to track who you sell it to. Classic honeytrap.',
        tier: 'episodic',
        importance: 0.8,
        stability: 0.9,
        category: 'incident',
      },
      {
        data: 'If someone is too eager to give you an in, the in is the trap. Every time.',
        tier: 'semantic',
        importance: 0.75,
        stability: 0.99,
        category: 'opsec',
      },
    ],
  },
  {
    sessionId: 'captain-solara',
    memories: [
      {
        data: 'The Kepler engagement: three Vanguard frigates against the Meridian dreadnought near the Cassian belt. We took the engines in two passes. Lost Ensign Devara in the third. The commendation felt obscene.',
        tier: 'episodic',
        importance: 0.95,
        stability: 0.99,
        category: 'combat',
      },
      {
        data: 'In debris fields denser than class 4, reduce thruster output to 40% and let inertia carry you through the first 300 meters. Active maneuvering creates a pressure signature that draws fragments inward.',
        tier: 'semantic',
        importance: 0.85,
        stability: 0.95,
        category: 'navigation',
      },
      {
        data: 'The crew of the Helix voted to continue the survey mission after losing atmospheric pressure in bay 3. No one asked them to. I noted it in the log. I did not know what else to do with it.',
        tier: 'episodic',
        importance: 0.7,
        stability: 0.9,
        category: 'crew',
      },
      {
        data: 'Uncharted sector 77-Kappa: anomalous gravitational readings consistent with a collapsed object less than 2km in diameter. No stellar remnant visible. Reported to Command. Classified immediately. Never discussed again.',
        tier: 'episodic',
        importance: 0.9,
        stability: 0.95,
        category: 'discovery',
      },
      {
        data: 'Fleet tactical doctrine assumes enemies will preserve their flagship. Most will. The ones who will not are the ones who have already lost something they considered worth more.',
        tier: 'semantic',
        importance: 0.8,
        stability: 0.9,
        category: 'tactics',
      },
      {
        data: 'Supply depot Kira-9 is running a 6-week lag on fuel cell allocations. Officially a logistics issue. The quartermaster drinks. Route around it.',
        tier: 'episodic',
        importance: 0.4,
        stability: 0.6,
        category: 'logistics',
      },
    ],
  },
  {
    sessionId: 'dr-osei-manu',
    memories: [
      {
        data: 'Cephalid specimen 7-C demonstrated tool use in the absence of any prior conditioning. Picked up a fragment of its feeding apparatus and used it to pry open a sealed container. Spontaneous. Unrepeatable. The most important thing I have ever witnessed.',
        tier: 'episodic',
        importance: 0.95,
        stability: 0.99,
        category: 'observation',
      },
      {
        data: 'Bioluminescent signaling in Vellari reef organisms encodes reproductive state, territorial claims, and threat level simultaneously via phase shift rather than amplitude. Current xenobiology models cannot represent phase-encoded parallel signals.',
        tier: 'semantic',
        importance: 0.85,
        stability: 0.95,
        category: 'research',
      },
      {
        data: 'Station Director Huang denied the extended sample collection permit. Budget cycle. The organisms we were studying migrate every 18 months. We have now missed this window. The decision was procedurally correct.',
        tier: 'episodic',
        importance: 0.6,
        stability: 0.8,
        category: 'fieldwork',
      },
      {
        data: 'The gut microbiome of organisms in high-radiation environments shows convergent adaptation across unrelated phyla: three specific archaeal species appear independently in every sample above 40 Gy exposure. Mechanism unknown.',
        tier: 'semantic',
        importance: 0.9,
        stability: 0.9,
        category: 'research',
      },
      {
        data: 'Field camp at Site 4 flooded during the second monsoon. Lost six months of physical specimens. The data was backed up. The specimens were irreplaceable. I keep thinking about this.',
        tier: 'episodic',
        importance: 0.5,
        stability: 0.85,
        category: 'fieldwork',
      },
      {
        data: 'No xenobiological organism studied to date has shown evidence of individual identity recognition beyond kin. The absence is notable. It may mean nothing. It may mean we are looking for it wrong.',
        tier: 'semantic',
        importance: 0.7,
        stability: 0.9,
        category: 'hypothesis',
      },
    ],
  },
];

async function seedAgent(
  storage: SqliteAdapter,
  embedder: OpenAIEmbeddingAdapter,
  agent: SeedAgent,
): Promise<void> {
  process.stdout.write(`  seeding ${agent.sessionId} (${agent.memories.length.toString()} memories)...\n`);
  const now = new Date();

  for (const memory of agent.memories) {
    const embedResult = await embedder.embed(memory.data);
    if (embedResult.isErr()) {
      process.stderr.write(`  embed failed for ${agent.sessionId}: ${JSON.stringify(embedResult.error)}\n`);
      process.exit(1);
    }

    const { vector, modelId, dimensions } = embedResult.value;

    const record: Omit<LtmRecord, 'id'> = {
      data: memory.data,
      metadata: {},
      embedding: vector,
      embeddingMeta: { modelId, dimensions },
      tier: memory.tier,
      importance: memory.importance,
      stability: memory.stability,
      lastAccessedAt: now,
      accessCount: 0,
      createdAt: now,
      tombstoned: false,
      tombstonedAt: undefined,
      sessionId: agent.sessionId,
      ...(memory.category !== undefined && { category: memory.category }),
    };

    storage.insertRecord(record);
  }
}

async function main(): Promise<void> {
  if (existsSync(DB_PATH)) {
    rmSync(DB_PATH);
    process.stdout.write(`wiped existing db at ${DB_PATH}\n`);
  }

  mkdirSync(path.dirname(DB_PATH), { recursive: true });

  const storage = new SqliteAdapter(DB_PATH);
  const embedder = new OpenAIEmbeddingAdapter({ apiKey: OPENAI_API_KEY });

  process.stdout.write(`seeding ${agents.length.toString()} agents into ${DB_PATH}\n`);

  for (const agent of agents) {
    await seedAgent(storage, embedder, agent);
  }

  const total = agents.reduce((sum, a) => sum + a.memories.length, 0);
  process.stdout.write(`done — ${total.toString()} memories across ${agents.length.toString()} agents\n`);
  process.stdout.write(`sessions: ${agents.map((a) => a.sessionId).join(', ')}\n`);
}

main().catch((err: unknown) => {
  process.stderr.write(`seed failed: ${String(err)}\n`);
  process.exit(1);
});
