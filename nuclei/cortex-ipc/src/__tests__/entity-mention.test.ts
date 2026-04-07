import { expectTypeOf, test } from 'vitest';

import type { EntityMention, EntityType } from '../index.js';

test('EntityType accepts valid entity types', () => {
  expectTypeOf<'person'>().toExtend<EntityType>();
  expectTypeOf<'project'>().toExtend<EntityType>();
  expectTypeOf<'concept'>().toExtend<EntityType>();
  expectTypeOf<'preference'>().toExtend<EntityType>();
  expectTypeOf<'decision'>().toExtend<EntityType>();
  expectTypeOf<'tool'>().toExtend<EntityType>();
});

test('EntityMention requires name and type', () => {
  expectTypeOf<{ name: string; type: EntityType }>().toExtend<EntityMention>();
});

test('EntityMention type field rejects unknown strings', () => {
  expectTypeOf<'unknown-type'>().not.toExtend<EntityType>();
});
