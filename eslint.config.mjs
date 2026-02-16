import {defineConfig} from 'eslint/config';
import js from '@eslint/js';
import tseslint from '@typescript-eslint/eslint-plugin';
import vitest from '@vitest/eslint-plugin';
import globals from 'globals';
import eslintConfigPrettier from 'eslint-config-prettier/flat';

export default defineConfig([
  {
    ignores: ['.yarn/**/*', 'coverage/**/*', 'dist/**/*']
  },
  js.configs.recommended,
  ...tseslint.configs['flat/recommended'],
  {
    languageOptions: {
      globals: {
        ...globals.node
      }
    }
  },
  {
    files: ['tests/**'],
    ...vitest.configs.recommended,
    languageOptions: {
      globals: {
        ...globals.node,
        ...vitest.environments.env.globals
      }
    }
  },
  {
    rules: {
      '@typescript-eslint/no-require-imports': [
        'error',
        {
          allowAsImport: true
        }
      ]
    }
  },
  eslintConfigPrettier
]);
