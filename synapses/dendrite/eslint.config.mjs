import baseConfig from '@neurome/eslint-config/base';
import nodeConfig from '@neurome/eslint-config/node';

export default [
  { ignores: ['dist/**', 'node_modules/**', 'eslint.config.mjs', 'vitest.config.ts'] },
  ...baseConfig,
  ...nodeConfig,
  {
    files: ['src/server.ts'],
    rules: {
      'neverthrow/no-try-catch': 'off',
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-argument': 'off',
    },
  },
];
