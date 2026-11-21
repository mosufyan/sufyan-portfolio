#!/usr/bin/env node
/**
 * Writes src/vitePublicEnv.generated.ts from process.env (and optionally .env).
 * Docker: ENV from --build-arg. Local: values from shell or .env file.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outPath = path.join(root, 'src/vitePublicEnv.generated.ts');
const envPath = path.join(root, '.env');

function loadDotEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return;
  for (const line of fs.readFileSync(filePath, 'utf8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#') || !trimmed.includes('=')) continue;
    const eq = trimmed.indexOf('=');
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (process.env[key] === undefined || process.env[key] === '') {
      process.env[key] = value;
    }
  }
}

loadDotEnvFile(envPath);

const key = (process.env.VITE_FIREBASE_API_KEY || '').trim();
const turnstile = (process.env.VITE_TURNSTILE_SITE_KEY || '').trim();
const recaptcha = (process.env.VITE_RECAPTCHA_SITE_KEY || '').trim();

if (!key) {
  console.error('ERROR: VITE_FIREBASE_API_KEY is required to generate vitePublicEnv.generated.ts');
  process.exit(1);
}

const body = `/* generated — do not edit */
export const GENERATED_VITE_FIREBASE_API_KEY = ${JSON.stringify(key)};
export const GENERATED_VITE_TURNSTILE_SITE_KEY = ${JSON.stringify(turnstile)};
export const GENERATED_VITE_RECAPTCHA_SITE_KEY = ${JSON.stringify(recaptcha)};
`;

fs.writeFileSync(outPath, body, 'utf8');
console.log('Wrote', path.relative(root, outPath), '(firebase key length =', key.length + ')');
