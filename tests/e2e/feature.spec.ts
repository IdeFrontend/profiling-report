import { test, expect } from '@playwright/test';
import { LANE_GROUP_HEADER_HEIGHT, LANE_HEIGHT } from '../../src/swimlane/CanvasSwimlaneRenderer';

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
    // First lane mid-row: LANE_GROUP_HEADER_HEIGHT + LANE_HEIGHT/2
    await page.mouse.move(box!.x + 8, box!.y + LANE_GROUP_HEADER_HEIGHT + LANE_HEIGHT / 2);
    await expect(page.getByTestId('event-tooltip')).toBeVisible();
  });

  test('PR-E2E-003: click selects event (UX S3)', async ({ page }) => {
    await page.goto('/');
    const canvas = page.getByTestId('swimlane-canvas');
    await expect(canvas).toBeVisible({ timeout: 15_000 });
    const box = await canvas.boundingBox();
    expect(box).toBeTruthy();
    await page.mouse.click(box!.x + 8, box!.y + LANE_GROUP_HEADER_HEIGHT + LANE_HEIGHT / 2);
    await expect(page.getByTestId('detail-panel')).toBeVisible();
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
    await expect(page.getByTestId('lane-util')).toHaveCount(0);
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
    await page.mouse.move(box!.x + 40, box!.y + LANE_GROUP_HEADER_HEIGHT + LANE_HEIGHT / 2);
    await expect(page.getByTestId('cursor-line')).toBeVisible();
    await expect(page.getByTestId('cursor-label')).toBeVisible();
    await expect(page.getByTestId('cursor-label')).toHaveText(/^\d{2}:\d{2}\.\d{3}$/);
  });

  test('PR-E2E-007: Chromium WebGL paints ffn_dense dependency curves', async ({ page }) => {
    const pageErrors: string[] = [];
    page.on('pageerror', (err) => pageErrors.push(err.message));

    await page.goto('/?fixture=ffn_dense&renderer=webgl');
    await expect(page.getByTestId('playground-ready')).toBeVisible();
    const swim = page.getByTestId('swimlane');
    await expect(swim).toBeVisible({ timeout: 15_000 });
    await expect(swim).toHaveAttribute('data-renderer', 'webgl');

    const gl = page.getByTestId('swimlane-webgl');
    await expect(gl).toBeVisible();
    const overlay = page.getByTestId('swimlane-canvas');
    const box = await overlay.boundingBox();
    expect(box).toBeTruthy();

    const panel = page.getByTestId('detail-panel');
    let painted = false;
    for (let lane = 0; lane < 12 && !painted; lane++) {
      const y = box!.y + LANE_GROUP_HEADER_HEIGHT + lane * LANE_HEIGHT + LANE_HEIGHT / 2;
      for (const xOff of [24, 80, 160, 280]) {
        await page.mouse.click(box!.x + xOff, y);
        const selected = await panel
          .waitFor({ state: 'visible', timeout: 400 })
          .then(() => true)
          .catch(() => false);
        if (!selected) continue;
        const deadline = Date.now() + 500;
        while (Date.now() < deadline) {
          if (Number((await gl.getAttribute('data-dep-curves')) ?? 0) > 0) {
            painted = true;
            break;
          }
          await page.evaluate(() => new Promise<void>((r) => requestAnimationFrame(() => r())));
        }
        if (painted) break;
      }
    }
    expect(painted).toBe(true);

    const gen = await gl.getAttribute('data-dep-graph-gen');
    expect(gen).toBeTruthy();
    await page.getByTestId('search-input').fill('matmul');
    await page.evaluate(
      () =>
        new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r()))),
    );
    await expect(gl).toHaveAttribute('data-dep-graph-gen', gen!);
    await expect(swim).toHaveAttribute('data-renderer', 'webgl');
    expect(pageErrors).toEqual([]);
  });

  test('PR-E2E-008: Relevent chips fill their track so curves start at the chip edge', async ({
    page,
  }) => {
    // The deps fixture pairs a short predecessor name with a long one — chips of
    // unequal length in one column is exactly when a content-sized chip falls short of
    // its connector. Wide viewport so neither name hits the truncation cap.
    await page.setViewportSize({ width: 1600, height: 900 });
    await page.goto('/?fixture=deps');
    await expect(page.getByTestId('playground-ready')).toBeVisible();
    const overlay = page.getByTestId('swimlane-canvas');
    await expect(overlay).toBeVisible({ timeout: 15_000 });
    const box = await overlay.boundingBox();
    expect(box).toBeTruthy();

    // Select MOV_OUT: the one task with two predecessors and two successors.
    const panel = page.getByTestId('detail-panel');
    const inCount = page.getByTestId('detail-relevant-incoming-count');
    let found = false;
    for (let lane = 0; lane < 8 && !found; lane++) {
      const y = box!.y + LANE_GROUP_HEADER_HEIGHT + lane * LANE_HEIGHT + LANE_HEIGHT / 2;
      for (const xOff of [24, 80, 160, 240, 320, 420, 520]) {
        await page.mouse.click(box!.x + xOff, y);
        if (!(await panel.isVisible())) continue;
        if ((await inCount.count()) === 0) continue;
        if (Number(await inCount.innerText()) >= 2) {
          found = true;
          break;
        }
      }
    }
    expect(found).toBe(true);

    // Every chip must span its whole track. Comparing chip-to-curve distance is not
    // enough: when all the names happen to be the same length the gap is zero either
    // way, and the assertion passes on a broken layout.
    const fill = await page.evaluate(() => {
      const cols = [...document.querySelectorAll('.pr-detail-relevant__side .pr-detail-relevant__column')];
      return cols.flatMap((col) => {
        const track = col.getBoundingClientRect().width;
        return [...col.querySelectorAll('.pr-detail-relevant__chip')].map(
          (chip) => track - chip.getBoundingClientRect().width,
        );
      });
    });

    expect(fill.length).toBeGreaterThanOrEqual(4);
    for (const short of fill) expect(Math.abs(short)).toBeLessThan(1);
  });
});
