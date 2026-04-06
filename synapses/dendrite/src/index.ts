import { AxonClient } from '@neurome/axon';

import { startServer } from './server.js';

export async function run(sessionId: string): Promise<void> {
  const axon = new AxonClient(sessionId);
  await startServer(axon, sessionId);
}
