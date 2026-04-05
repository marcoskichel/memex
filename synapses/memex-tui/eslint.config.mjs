import baseConfig from '@memex/eslint-config/base';
import nodeConfig from '@memex/eslint-config/node';

export default [
  { ignores: ['dist/**', 'node_modules/**', 'eslint.config.mjs', 'vitest.config.ts'] },
  ...baseConfig,
  ...nodeConfig,
  {
    files: ['src/bin/**/*.ts'],
    rules: {
      'unicorn/no-process-exit': 'off',
    },
  },
  {
    files: ['src/components/**/*.tsx', 'src/client/**/*.ts'],
    rules: {
      'neverthrow/no-throw': 'off',
      'neverthrow/no-try-catch': 'off',
      'neverthrow/no-promise-reject': 'off',
      'no-restricted-syntax': 'off',
      'max-lines-per-function': 'off',
      'unicorn/no-process-exit': 'off',
    },
  },
];
