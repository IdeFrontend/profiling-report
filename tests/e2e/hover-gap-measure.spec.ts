import { expect, test } from '@playwright/test';
import { LANE_GROUP_HEADER_HEIGHT, LANE_HEIGHT } from '../../src/swimlane/CanvasSwimlaneRenderer';

test('hover gap measure overlay appears between events', async ({ page }) => {
  test.setTimeout(60_000);
  await page.goto('/?fixture=sample&renderer=canvas');
  await page.waitForSelector('[data-testid="swimlane-canvas"]', { timeout: 30_000 });

  const canvas = page.locator('[data-testid="swimlane-canvas"]');
  const box = await canvas.boundingBox();
  expect(box).toBeTruthy();

  // Zoom in so sub-microsecond matmul gaps are wide enough for inline Δt.
  const zoomIn = page.getByTestId('zoom-in');
  await expect(zoomIn).toBeVisible({ timeout: 15_000 });
  for (let i = 0; i < 8; i++) {
    await zoomIn.click();
  }

  const gap = page.locator('[data-testid="gap-measure"]');
  let found = false;
  for (let lane = 0; lane < 28; lane++) {
    const y = box!.y + LANE_GROUP_HEADER_HEIGHT + lane * LANE_HEIGHT + LANE_HEIGHT / 2;
    if (y > box!.y + box!.height - 2) break;
    for (let px = 48; px < box!.width - 48; px += 10) {
      await page.mouse.move(box!.x + px, y);
      if ((await gap.count()) > 0) {
        found = true;
        break;
      }
    }
    if (found) break;
  }

  expect(found).toBe(true);
  await expect(page.locator('[data-testid="gap-measure-stick-left"]')).toBeVisible();
  await expect(page.locator('[data-testid="gap-measure-stick-right"]')).toBeVisible();
  await expect(page.locator('[data-testid="measure-label"]')).toBeVisible();
});
