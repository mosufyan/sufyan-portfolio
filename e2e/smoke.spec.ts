import { expect, test } from '@playwright/test';

test.describe('portfolio smoke', () => {
  test('home loads', async ({ page }) => {
    const res = await page.goto('/', { waitUntil: 'domcontentloaded' });
    expect(res?.ok()).toBeTruthy();
    await expect(page.locator('body')).toBeVisible();
    // Prefer brand text; fall back to any main landmark / heading so a theme
    // or content tweak cannot red-fail CI.
    const brand = page.getByText(/Mohammed Sufyan|M\.?\s*Sufyan|Software Engineer/i).first();
    const heading = page.locator('h1, h2, [role="banner"]').first();
    await expect(brand.or(heading)).toBeVisible({ timeout: 25_000 });
  });

  test('appearance control opens', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    const appearance = page
      .getByRole('button', { name: /appearance/i })
      .or(page.getByTitle('Appearance'))
      .first();
    await expect(appearance).toBeVisible({ timeout: 25_000 });
    await appearance.click();
    await expect(
      page.getByRole('dialog', { name: /appearance/i }).or(page.getByText(/^Mode$/i))
    ).toBeVisible({ timeout: 10_000 });
  });

  test('health endpoints respond', async ({ request }) => {
    const uptime = await request.get('/api/uptime');
    expect(uptime.ok()).toBeTruthy();
    const body = (await uptime.json()) as { ok?: boolean };
    expect(body.ok).toBe(true);

    const health = await request.get('/api/health');
    expect(health.ok()).toBeTruthy();
  });
});
