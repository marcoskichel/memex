import { render } from 'ink';
import React from 'react';

import { App } from '../components/app.js';

const engramId = process.env.NEUROME_ENGRAM_ID;

if (!engramId) {
  process.stderr.write('neurome-tui: NEUROME_ENGRAM_ID is required\n');
  process.exit(1);
}

render(React.createElement(App, { engramId }));
