import { test, expect } from '@playwright/test';

/**
 * Feature e2e — expected RED until UI-shell + parse slices land.
 * Playground must load data/out.rep into ProfilingReport.
 */

test.describe('PR-E2E feature paths', () => {
  test('PR-E2E-001: playground loads out.rep timeline (UX S1, interim I-Q4)', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByTestId('playground-ready')).toBeVisible();
    await expect(page.getByTestId('profiling-report')).toBeVisible();
    await expect(page.getByTestId('swimlane')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByTestId('pipe-occupancy')).toBeVisible();
    await expect(page.getByTestId('overview-charts')).toHaveCount(0);
  });

  test('PR-E2E-002: hover shows tooltip (UX S3)', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByTestId('swimlane')).toBeVisible({ timeout: 15_000 });
    const event = page.locator('[data-testid^="swim-event-"]').first();
    await expect(event).toBeVisible();
    await event.hover();
    await expect(page.getByTestId('event-tooltip')).toBeVisible();
  });

  test('PR-E2E-003: click selects event (UX S3)', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByTestId('swimlane')).toBeVisible({ timeout: 15_000 });
    const event = page.locator('[data-testid^="swim-event-"]').first();
    await event.click();
    await expect(page.getByTestId('detail-strip')).toBeVisible();
  });
});
