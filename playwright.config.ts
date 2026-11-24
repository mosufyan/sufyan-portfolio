import { defineConfig, devices } from '@playwright/test';

const PORT = Number(process.env.PLAYWRIGHT_PORT || 4173);
const BASE_URL = process.env.PLAYWRIGHT_BASE_URL || `http://127.0.0.1:${PORT}`;

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? [['github'], ['list']] : 'list',
  use: {
    baseURL: BASE_URL,
    trace: 'on-first-retry',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  // CI starts the Express server in the workflow; locally reuse PLAYWRIGHT_BASE_URL if set.
  webServer: process.env.PLAYWRIGHT_BASE_URL
    ? undefined
    : {
        command: `SESSION_SECRET=ci-playwright-session-secret-32chars NODE_ENV=production PORT=${PORT} npm start`,
        url: `${BASE_URL}/api/uptime`,
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
      },
});
