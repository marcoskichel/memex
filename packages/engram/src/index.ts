export { EngramEngine } from './engram-engine.js';
export type { EngramOptions, EngramRecord } from './engram-engine.js';

import { EngramEngine, type EngramOptions } from './engram-engine.js';

export function createEngramEngine(options: EngramOptions = {}): EngramEngine {
  return new EngramEngine(options);
}
