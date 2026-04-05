import { describe, expect, it } from 'vitest';

import { IPC_SOCKET_PATH } from '../../ipc/protocol.js';

describe('IPC_SOCKET_PATH', () => {
  it('generates socket path with session id', () => {
    expect(IPC_SOCKET_PATH('abc123')).toBe('/tmp/memex-abc123.sock');
  });

  it('encodes the session id directly', () => {
    expect(IPC_SOCKET_PATH('my-session-id')).toBe('/tmp/memex-my-session-id.sock');
  });
});
