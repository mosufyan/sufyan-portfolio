import fs from 'fs';
import path from 'path';
import { defineConfig } from 'vitest/config';

// Ensure generated module exists for unit tests (empty keys are fine in node tests).
const generatedPath = path.resolve(import.meta.dirname, 'src/vitePublicEnv.generated.ts');
if (!fs.existsSync(generatedPath)) {
  fs.writeFileSync(
    generatedPath,
    `export const GENERATED_VITE_FIREBASE_API_KEY = '';
export const GENERATED_VITE_TURNSTILE_SITE_KEY = '';
export const GENERATED_VITE_RECAPTCHA_SITE_KEY = '';
`,
    'utf8'
  );
}

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts', 'server/**/*.test.ts'],
    reporters: ['default'],
  },
});
