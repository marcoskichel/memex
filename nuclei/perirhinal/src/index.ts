export type { EntityType } from '@neurome/entorhinal';
export type {
  EntityInsertPlan,
  EntityResolution,
  ExtractedEdge,
  ExtractedEntity,
  ExtractionError,
  ExtractionInput,
  PerirhinalStats,
} from './core/types.js';
export { EntityExtractionProcess, persistInsertPlan } from './shell/entity-extraction-process.js';
export type { EntityExtractionProcessOptions } from './shell/entity-extraction-process.js';
