import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';
import eslintConfigPrettier from 'eslint-config-prettier';

export default tseslint.config(
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  eslintConfigPrettier,
  {
    ignores: [
      '**/dist/**',
      '**/node_modules/**',
      '**/dist-cjs/**',
      '**/*.js',
      '**/*.cjs',
      '**/*.mjs',
      'docs/.vitepress/**',
      'packages/chrome-extension/dist/**',
      'packages/web-ui/dist/**',
    ],
  },
  {
    files: ['**/*.ts'],
    rules: {
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/explicit-function-return-type': 'off',
      '@typescript-eslint/no-require-imports': 'off',
      'no-console': 'off',
      'prefer-const': 'error',
      'no-var': 'error',
    },
  },
);
