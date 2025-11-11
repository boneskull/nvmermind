// @ts-check
import jsPlugin from '@eslint/js';
import stylistic from '@stylistic/eslint-plugin';
import eslintPluginJsonc from 'eslint-plugin-jsonc';
import perfectionist from 'eslint-plugin-perfectionist';
import {defineConfig} from 'eslint/config';
import globals from 'globals';

export default defineConfig(
  jsPlugin.configs.recommended,
  perfectionist.configs['recommended-natural'],
  {
    languageOptions: {
      parserOptions: {
        extraFileExtensions: ['.json5', '.jsonc'],
        project: 'tsconfig.json',
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
  {
    files: ['**/*.js', '.*.js'],
    languageOptions: {
      globals: globals.node,
      sourceType: 'script',
    },
    plugins: {
      '@perfectionist': perfectionist,
      '@stylistic': stylistic,
    },
    rules: {
      '@perfectionist/sort-classes': ['error', {partitionByNewLine: true}],
      '@stylistic/lines-around-comment': [
        'warn',
        {
          afterBlockComment: false,
          allowArrayStart: true,
          allowBlockStart: true,
          allowClassStart: true,
          allowInterfaceStart: true,
          allowObjectStart: true,
          beforeBlockComment: false,
        },
      ],
      '@stylistic/lines-between-class-members': ['error', 'always'],
      '@stylistic/semi': 'error',
      curly: 'error',
      'func-style': ['error', 'expression'],
      'new-cap': ['error', {capIsNew: true, newIsCap: true}],
      'no-constructor-return': 'error',
      'no-empty': ['error', {allowEmptyCatch: true}],
      'no-self-compare': 'error',
      'object-shorthand': ['error', 'always'],
      'prefer-arrow-callback': 'error',
      semi: 'error',
    },
  },
  ...eslintPluginJsonc.configs['flat/prettier'],
  {
    ignores: [
      'docs',
      'dist',
      'coverage',
      '*.snapshot',
      '.tmp/**/*',
      'worktrees/**/*',
    ],
  },
);
