import baseConfig from '@neurome/eslint-config/base';
import neverthrowConfig from '@neurome/eslint-config/neverthrow';
import nodeConfig from '@neurome/eslint-config/node';

export default [
  {
    ignores: ['dist/**', 'node_modules/**', 'eslint.config.mjs', 'vitest.config.ts', 'scripts/**'],
  },
  ...baseConfig,
  ...nodeConfig,
  ...neverthrowConfig,
];
