import { test, expect } from '@playwright/test';

/**
 * Feature e2e — playground loads data/out.rep into ProfilingReport.
 */

test.describe('PR-E2E feature paths', () => {
  test('PR-E2E-001: playground loads out.rep timeline (UX S1, interim I-Q4)', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByTestId('playground-ready')).toBeVisible();
    await expect(page.getByTestId('profiling-report')).toBeVisible();
    await expect(page.getByTestId('swimlane')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByTestId('swimlane-canvas')).toBeVisible();
    await expect(page.getByTestId('pipe-occupancy')).toBeVisible();
    await expect(page.getByTestId('overview-charts')).toHaveCount(0);
  });

  test('PR-E2E-002: hover shows tooltip (UX S3)', async ({ page }) => {
    await page.goto('/');
    const canvas = page.getByTestId('swimlane-canvas');
    await expect(canvas).toBeVisible({ timeout: 15_000 });
    const box = await canvas.boundingBox();
    expect(box).toBeTruthy();
    // First lane mid-row: LANE_GROUP_HEADER_HEIGHT(28) + LANE_HEIGHT/2(~11)
    await page.mouse.move(box!.x + 8, box!.y + 28 + 11);
    await expect(page.getByTestId('event-tooltip')).toBeVisible();
  });

  test('PR-E2E-003: click selects event (UX S3)', async ({ page }) => {
    await page.goto('/');
    const canvas = page.getByTestId('swimlane-canvas');
    await expect(canvas).toBeVisible({ timeout: 15_000 });
    const box = await canvas.boundingBox();
    expect(box).toBeTruthy();
    await page.mouse.click(box!.x + 8, box!.y + 28 + 11);
    await expect(page.getByTestId('detail-strip')).toBeVisible();
  });

  test('PR-E2E-004: zoom-to-fit toolbar (UX S2)', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByTestId('report-toolbar')).toBeVisible({ timeout: 15_000 });
    await page.getByTestId('zoom-in').click();
    await page.getByTestId('zoom-to-fit').click();
    await expect(page.getByTestId('swimlane-canvas')).toBeVisible();
  });

  test('PR-E2E-005: standalone Chrome Trace hides aside (Q15)', async ({ page }) => {
    await page.goto('/?fixture=trace');
    await expect(page.getByTestId('playground-ready')).toBeVisible();
    await expect(page.getByTestId('swimlane')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByTestId('pipe-occupancy')).toHaveCount(0);
    await expect(page.getByTestId('stats-summary')).toHaveCount(0);
    await expect(page.getByTestId('lane-util').first()).toBeVisible();
  });

  test('PR-E2E-006: time overview and mouse cursor line (sketch parity)', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByTestId('time-overview')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByTestId('time-overview-window')).toBeVisible();
    await expect(page.getByTestId('time-overview-handle-left')).toBeVisible();
    await expect(page.getByTestId('time-overview-handle-right')).toBeVisible();
    // No stale playhead before mouse move
    await expect(page.getByTestId('playhead')).toHaveCount(0);
    const canvas = page.getByTestId('swimlane-canvas');
    const box = await canvas.boundingBox();
    expect(box).toBeTruthy();
    await page.mouse.move(box!.x + 40, box!.y + 28 + 11);
    await expect(page.getByTestId('cursor-line')).toBeVisible();
    await expect(page.getByTestId('cursor-label')).toBeVisible();
    await expect(page.getByTestId('cursor-label')).toHaveText(/^\d{2}:\d{2}\.\d{3}$/);
  });
});
