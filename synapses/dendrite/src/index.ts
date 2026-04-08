import { AxonClient } from '@neurome/axon';

import { startServer } from './server.js';

export async function run(engramId: string, accessMode: string): Promise<void> {
  const axon = new AxonClient(engramId);
  await startServer(axon, { engramId, accessMode });
}
