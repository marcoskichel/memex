import type { EntityMention, LtmRecord } from '@neurome/ltm';

import type { ExtractionInput } from './types.js';

export function extractEntitiesFromRecord(record: LtmRecord): ExtractionInput | undefined {
  const entities = record.metadata.entities as EntityMention[] | undefined;
  if (!entities || entities.length === 0) {
    return undefined;
  }

  const entityList = entities.map((entity) => `- ${entity.name} (${entity.type})`).join('\n');

  const prompt = `Extract entity nodes and relationship edges from the following memory record.

Record content: ${record.data}

Known entities in this record:
${entityList}

For each entity, confirm or refine the name and type. Identify any directed relationships between entities.`;

  return { record, prompt };
}
