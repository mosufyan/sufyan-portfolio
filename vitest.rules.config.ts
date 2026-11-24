import { defineConfig } from 'vitest/config';

/** Firestore rules unit tests — run under `firebase emulators:exec`. */
export default defineConfig({
  test: {
    include: ['firestore.rules.test.ts'],
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 60_000,
  },
});
