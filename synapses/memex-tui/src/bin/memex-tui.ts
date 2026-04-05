import { render } from 'ink';
import React from 'react';

import { App } from '../components/app.js';

const sessionId = process.env.MEMORY_SESSION_ID;

if (!sessionId) {
  process.stderr.write('memex-tui: MEMORY_SESSION_ID is required\n');
  process.exit(1);
}

render(React.createElement(App, { sessionId }));
