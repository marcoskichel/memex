import baseConfig from './packages/eslint-config/base.mjs';
import nodeConfig from './packages/eslint-config/node.mjs';
import neverthrowConfig from './packages/eslint-config/neverthrow.mjs';

export default [
  { ignores: ['**/dist/**', '**/node_modules/**', '**/vitest.config.ts', '**/eslint.config.mjs'] },
  ...baseConfig,
  ...nodeConfig,
  ...neverthrowConfig,
  {
    files: ['**/src/bin/**/*.ts', '**/synapses/**/src/bin/**/*.ts'],
    rules: {
      'unicorn/no-process-exit': 'off',
      'neverthrow/no-throw': 'off',
      'neverthrow/no-try-catch': 'off',
    },
  },
];
