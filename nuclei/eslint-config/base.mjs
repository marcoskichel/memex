import eslintConfigPrettier from 'eslint-config-prettier';
import humanFirst from 'eslint-plugin-human-first';
import importPlugin from 'eslint-plugin-import';
import eslintPluginUnicorn from 'eslint-plugin-unicorn';

export default [
  humanFirst.configs.recommended,
  eslintPluginUnicorn.configs.recommended,
  eslintConfigPrettier,
  {
    plugins: { import: importPlugin },
    rules: {
      'import/order': [
        'error',
        {
          groups: ['builtin', 'external', ['parent', 'sibling', 'index']],
          pathGroups: [{ pattern: '@/**', group: 'parent', position: 'before' }],
          pathGroupsExcludedImportTypes: ['builtin'],
          'newlines-between': 'always',
          alphabetize: { order: 'asc', caseInsensitive: true, orderImportKind: 'asc' },
          named: { enabled: true, types: 'types-last' },
        },
      ],
    },
  },
  {
    rules: {
      curly: ['error', 'all'],
      'id-length': ['error', { min: 2, exceptions: ['_', 'x', 'y'] }],
      'unicorn/prevent-abbreviations': [
        'error',
        { replacements: { db: false, env: false, params: false, props: false } },
      ],
    },
  },
  {
    files: ['**/__tests__/**', '**/scripts/**'],
    rules: {
      'human-first/no-magic-numbers': 'off',
      'human-first/no-comments': 'off',
      'max-lines-per-function': 'off',
      'max-lines': 'off',
    },
  },
];
