import { expect, test } from '@playwright/test';

test('hover gap measure overlay appears between events', async ({ page }) => {
  await page.goto('/?fixture=sample&renderer=canvas');
  await page.waitForSelector('[data-testid="swimlane-canvas"]', { timeout: 30_000 });
  await page.waitForTimeout(2000);

  const canvas = page.locator('[data-testid="swimlane-canvas"]');
  const box = await canvas.boundingBox();
  expect(box).toBeTruthy();

  let found = false;
  for (let py = 80; py < box!.height - 40; py += 8) {
    for (let px = 80; px < box!.width - 80; px += 12) {
      await page.mouse.move(box!.x + px, box!.y + py);
      if (await page.locator('[data-testid="gap-measure"]').isVisible()) {
        found = true;
        await expect(page.locator('[data-testid="gap-measure-stick-left"]')).toBeVisible();
        await expect(page.locator('[data-testid="gap-measure-stick-right"]')).toBeVisible();
        await expect(page.locator('[data-testid="measure-label"]')).toBeVisible();
        break;
      }
    }
    if (found) break;
  }

  expect(found).toBe(true);
});
