#!/usr/bin/env node
/**
 * Run Lighthouse against a local production URL and enforce score floors.
 */
import { spawn } from 'child_process';
import fs from 'fs';
import { createRequire } from 'module';
import path from 'path';

const require = createRequire(import.meta.url);
const lighthouse = require('lighthouse');
const chromeLauncher = require('chrome-launcher');

const BASE = process.env.LIGHTHOUSE_BASE_URL || 'http://127.0.0.1:3018';
const PORT = Number(new URL(BASE).port || 3018);
const MANAGED = !process.env.LIGHTHOUSE_BASE_URL;

const MIN = {
  // CI VMs are noisy; keep meaningful floors without flaking on cold starts.
  accessibility: 0.7,
  'best-practices': 0.7,
  seo: 0.7,
  performance: 0.2,
};

async function waitReady(url, attempts = 60) {
  for (let i = 0; i < attempts; i++) {
    try {
      const res = await fetch(`${url}/api/uptime`);
      if (res.ok) return;
    } catch {
      /* retry */
    }
    await new Promise((r) => setTimeout(r, 1000));
  }
  throw new Error(`Server not ready at ${url}`);
}

let child;
if (MANAGED) {
  if (!fs.existsSync('dist')) {
    console.error('::error::dist/ missing — run production build first');
    process.exit(1);
  }
  child = spawn('npm', ['start'], {
    env: {
      ...process.env,
      NODE_ENV: 'production',
      PORT: String(PORT),
      SESSION_SECRET: process.env.SESSION_SECRET || 'ci-lighthouse-session-secret-32chars',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  const log = fs.createWriteStream('/tmp/lighthouse-server.log');
  child.stdout?.pipe(log);
  child.stderr?.pipe(log);
}

try {
  await waitReady(BASE);
  const chrome = await chromeLauncher.launch({
    chromePath: process.env.CHROME_PATH || undefined,
    chromeFlags: ['--headless', '--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage'],
  });
  try {
    const result = await lighthouse(BASE, {
      port: chrome.port,
      output: 'json',
      onlyCategories: ['performance', 'accessibility', 'best-practices', 'seo'],
      formFactor: 'desktop',
      screenEmulation: { disabled: true },
    });
    const cats = result.lhr.categories;
    const scores = {};
    let failed = false;
    for (const [id, min] of Object.entries(MIN)) {
      const score = cats[id]?.score ?? 0;
      scores[id] = score;
      const ok = score >= min;
      console.log(`${id}: ${score.toFixed(2)} (min ${min}) ${ok ? 'OK' : 'FAIL'}`);
      if (!ok) {
        console.error(`::error::Lighthouse ${id} score ${score.toFixed(2)} < ${min}`);
        failed = true;
      }
    }
    fs.writeFileSync(
      path.join('/tmp', 'lighthouse-ci.json'),
      JSON.stringify({ scores }, null, 2)
    );
    if (failed) process.exit(1);
    console.log('OK: Lighthouse floors met', scores);
  } finally {
    await chrome.kill();
  }
} finally {
  if (child?.pid) {
    try {
      process.kill(child.pid, 'SIGTERM');
    } catch {
      /* already exited */
    }
  }
}
