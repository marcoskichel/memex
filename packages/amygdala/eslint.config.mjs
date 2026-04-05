import baseConfig from '@memex/eslint-config/base';
import neverthrowConfig from '@memex/eslint-config/neverthrow';
import nodeConfig from '@memex/eslint-config/node';

export default [
  { ignores: ['dist/**', 'node_modules/**', 'eslint.config.mjs', 'vitest.config.ts'] },
  ...baseConfig,
  ...nodeConfig,
  ...neverthrowConfig,
];
