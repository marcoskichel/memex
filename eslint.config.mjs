import baseConfig from './packages/eslint-config/base.mjs';
import nodeConfig from './packages/eslint-config/node.mjs';

export default [
  { ignores: ['**/dist/**', '**/node_modules/**', '**/vitest.config.ts', '**/eslint.config.mjs'] },
  ...baseConfig,
  ...nodeConfig,
];
