import { test, expect } from '@playwright/test';

test('PR-SCAFFOLD-004: playground loads ProfilingReport placeholder', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByTestId('playground-ready')).toBeVisible();
  await expect(page.getByTestId('profiling-report')).toBeVisible();
});
