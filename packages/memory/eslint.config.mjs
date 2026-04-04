import baseConfig from '@neurokit/eslint-config/base';
import neverthrowConfig from '@neurokit/eslint-config/neverthrow';
import nodeConfig from '@neurokit/eslint-config/node';

export default [
  { ignores: ['dist/**', 'node_modules/**', 'eslint.config.mjs', 'vitest.config.ts'] },
  ...baseConfig,
  ...nodeConfig,
  ...neverthrowConfig,
];
