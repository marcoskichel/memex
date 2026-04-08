import baseConfig from '@neurome/eslint-config/base';
import nodeConfig from '@neurome/eslint-config/node';

export default [
  {
    ignores: ['dist/**', 'node_modules/**', 'eslint.config.mjs'],
  },
  ...baseConfig,
  ...nodeConfig,
];
