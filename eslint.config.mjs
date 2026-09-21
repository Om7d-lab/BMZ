// @ts-check
import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      '**/.next/**',
      '**/coverage/**',
      '**/generated/**',
      'apps/api/prisma/migrations/**',
      // Vendored third-party design skills (see .claude/skills/README.md).
      '.claude/skills/**',
    ],
  },
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  {
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_' },
      ],
      '@typescript-eslint/consistent-type-imports': [
        'error',
        { prefer: 'type-imports', fixStyle: 'inline-type-imports' },
      ],
      '@typescript-eslint/no-explicit-any': 'warn',
      eqeqeq: ['error', 'smart'],
      'no-console': ['warn', { allow: ['warn', 'error'] }],
    },
  },
  {
    // NestJS leans on decorators and parameter injection; these rules fight that.
    files: ['apps/api/**/*.ts'],
    rules: {
      '@typescript-eslint/no-extraneous-class': 'off',
      '@typescript-eslint/no-empty-object-type': 'off',
      // A class injected through a constructor parameter appears, syntactically,
      // only in type position — but `emitDecoratorMetadata` reads that parameter
      // to emit `design:paramtypes`, which is how Nest resolves the dependency at
      // runtime. Rewriting those to `import type` erases the emit and every
      // provider fails to inject. The rule cannot tell the two cases apart, so it
      // is off for the API and left on everywhere else.
      '@typescript-eslint/consistent-type-imports': 'off',
    },
  },
  {
    files: ['**/*.config.{js,mjs,ts}', '**/scripts/**/*.{js,mjs,ts}', '**/seed.ts'],
    rules: { 'no-console': 'off' },
  },
);
