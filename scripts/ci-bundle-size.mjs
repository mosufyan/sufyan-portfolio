#!/usr/bin/env node
/**
 * Fail if production JS assets exceed budgets (guards accidental bundle bloat).
 */
import fs from 'fs';
import path from 'path';

const DIST = path.resolve('dist');
const ASSETS = path.join(DIST, 'assets');
/** Total hashed JS under dist/assets (gzip not required — raw bytes). */
const MAX_TOTAL_JS_BYTES = 4.5 * 1024 * 1024;
/** Largest single JS chunk (main SPA + Firebase/chat is ~2.4 MiB today). */
const MAX_SINGLE_JS_BYTES = 3.0 * 1024 * 1024;

if (!fs.existsSync(ASSETS)) {
  console.error('::error::dist/assets missing — run production build first');
  process.exit(1);
}

const jsFiles = fs
  .readdirSync(ASSETS)
  .filter((f) => f.endsWith('.js'))
  .map((f) => {
    const full = path.join(ASSETS, f);
    return { name: f, size: fs.statSync(full).size };
  })
  .sort((a, b) => b.size - a.size);

if (!jsFiles.length) {
  console.error('::error::No JS assets found under dist/assets');
  process.exit(1);
}

const total = jsFiles.reduce((sum, f) => sum + f.size, 0);
const largest = jsFiles[0];

const fmt = (n) => `${(n / 1024 / 1024).toFixed(2)} MiB`;

console.log('JS assets (largest first):');
for (const f of jsFiles.slice(0, 12)) {
  console.log(`  ${fmt(f.size).padStart(10)}  ${f.name}`);
}
console.log(`Total JS: ${fmt(total)} (budget ${fmt(MAX_TOTAL_JS_BYTES)})`);
console.log(`Largest:  ${fmt(largest.size)} ${largest.name} (budget ${fmt(MAX_SINGLE_JS_BYTES)})`);

let failed = false;
if (total > MAX_TOTAL_JS_BYTES) {
  console.error(`::error::Total JS ${fmt(total)} exceeds ${fmt(MAX_TOTAL_JS_BYTES)}`);
  failed = true;
}
if (largest.size > MAX_SINGLE_JS_BYTES) {
  console.error(
    `::error::Largest chunk ${largest.name} is ${fmt(largest.size)} (max ${fmt(MAX_SINGLE_JS_BYTES)})`
  );
  failed = true;
}

if (failed) process.exit(1);
console.log('OK: bundle size within budget');
