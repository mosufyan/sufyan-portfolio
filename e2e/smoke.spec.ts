import { expect, test } from '@playwright/test';

test.describe('portfolio smoke', () => {
  test('home loads with brand signal', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('body')).toBeVisible();
    // Brand / name should be present in the first viewport composition.
    await expect(page.getByText(/Mohammed Sufyan|M\.?\s*Sufyan/i).first()).toBeVisible({
      timeout: 20_000,
    });
  });

  test('appearance control is reachable', async ({ page }) => {
    await page.goto('/');
    const appearance = page.getByRole('button', { name: /appearance/i }).first();
    await expect(appearance).toBeVisible({ timeout: 20_000 });
    await appearance.click();
    await expect(page.getByRole('dialog', { name: /appearance/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /dark/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /cyan|amber/i }).first()).toBeVisible();
  });

  test('health endpoints respond', async ({ request }) => {
    const uptime = await request.get('/api/uptime');
    expect(uptime.ok()).toBeTruthy();
    const body = await uptime.json();
    expect(body.ok).toBe(true);
  });
});
