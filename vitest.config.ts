import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['**/*.{test,spec}.{ts,tsx}'],
    exclude: [
      '**/node_modules/**',
      '**/dist/**',
      '**/dev-dist/**',
      '**/e2e/**',
      '**/firestore.rules.test.ts',
    ],
    coverage: {
      provider: 'v8',
      include: ['server/**/*.ts', 'src/utils/**/*.ts', 'src/theme/**/*.ts'],
      exclude: [
        '**/*.{test,spec}.{ts,tsx}',
        'server.ts',
        '**/firestore.rules.test.ts',
      ],
      reporter: ['text', 'lcov'],
      thresholds: {
        lines: 50,
        functions: 50,
        branches: 40,
        statements: 50,
      },
    },
  },
});
