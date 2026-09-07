import { test, expect, type Page } from '@playwright/test';
import { LANE_GROUP_HEADER_HEIGHT, LANE_HEIGHT } from '../../src/swimlane/CanvasSwimlaneRenderer';
import { DOCK_HEIGHT_COLLAPSED, DOCK_HEIGHT_EXPANDED } from '../../src/ui/panelResize';

/** With fit = [minTime, maxTime], events fill the canvas; probe near the left first. */
const EVENT_X_FRACTIONS = [0.02, 0.05, 0.1, 0.15, 0.2, 0.35, 0.5, 0.65, 0.8];

type CanvasBox = { x: number; y: number; width: number; height: number };

function xOffsets(box: CanvasBox, fractions: number[]): number[] {
  return fractions.map((f) => Math.min(Math.round(f * box.width), box.width - 4));
}

async function waitForDepCurves(
  page: Page,
  gl: ReturnType<Page['getByTestId']>,
  timeoutMs: number,
): Promise<boolean> {
  const before = Number((await gl.getAttribute('data-dep-curves')) ?? 0);
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const now = Number((await gl.getAttribute('data-dep-curves')) ?? 0);
    if (now > 0 && now !== before) return true;
    await page.evaluate(() => new Promise<void>((r) => requestAnimationFrame(() => r())));
  }
  return false;
}

async function probeSwimlane(
  page: Page,
  box: CanvasBox,
  opts: {
    action: 'move' | 'click';
    expectTestId: 'event-tooltip' | 'detail-panel';
    maxLanes?: number;
    xFractions?: number[];
    hitTimeoutMs?: number;
    predicate?: () => Promise<boolean>;
  },
): Promise<boolean> {
  const maxLanes = opts.maxLanes ?? 12;
  const fractions = opts.xFractions ?? EVENT_X_FRACTIONS;
  const hitTimeoutMs = opts.hitTimeoutMs ?? 400;
  for (let lane = 0; lane < maxLanes; lane++) {
    const y = box.y + LANE_GROUP_HEADER_HEIGHT + lane * LANE_HEIGHT + LANE_HEIGHT / 2;
    for (const xOff of xOffsets(box, fractions)) {
      const x = box.x + xOff;
      if (opts.action === 'move') await page.mouse.move(x, y);
      else await page.mouse.click(x, y);
      const hit = await page
        .getByTestId(opts.expectTestId)
        .waitFor({ state: 'visible', timeout: hitTimeoutMs })
        .then(() => true)
        .catch(() => false);
      if (!hit) continue;
      if (opts.predicate && !(await opts.predicate())) continue;
      return true;
    }
  }
  return false;
}

/** Click until WebGL dependency curves paint (avoids sticky detail-panel false hits). */
async function probeSwimlaneDepCurves(
  page: Page,
  gl: ReturnType<Page['getByTestId']>,
  box: CanvasBox,
  opts?: { maxLanes?: number; xOffsetsPx?: number[]; paintTimeoutMs?: number },
): Promise<boolean> {
  const maxLanes = opts?.maxLanes ?? 24;
  const offsets = opts?.xOffsetsPx ?? [24, 80, 160, 280, 420];
  const paintTimeoutMs = opts?.paintTimeoutMs ?? 400;
  for (let lane = 0; lane < maxLanes; lane++) {
    const y = box.y + LANE_GROUP_HEADER_HEIGHT + lane * LANE_HEIGHT + LANE_HEIGHT / 2;
    for (const xOff of offsets) {
      if (xOff >= box.width - 2) continue;
      await page.mouse.click(box.x + xOff, y);
      if (await waitForDepCurves(page, gl, paintTimeoutMs)) return true;
    }
  }
  return false;
}

/**
 * Feature e2e — playground loads data/sample.lite.rep into ProfilingReport by default.
 */

test.describe('PR-E2E feature paths', () => {
  test('PR-E2E-001: playground loads sample.lite.rep timeline (UX S1, interim DATA-31a)', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByTestId('playground-ready')).toBeVisible();
    await expect(page.getByTestId('profiling-report')).toBeVisible();
    await expect(page.getByTestId('swimlane')).toBeVisible({ timeout: 30_000 });
    await expect(page.getByTestId('swimlane-canvas')).toBeVisible();
    await expect(page.getByTestId('pipe-occupancy')).toBeVisible();
    await expect(page.getByTestId('overview-charts')).toHaveCount(0);
  });

  test('PR-E2E-011: playground loads the product 160-byte npu-rep sample (in-browser parse)', async ({ page }) => {
    await page.goto('/?fixture=npu160');
    await expect(page.getByTestId('playground-ready')).toBeVisible();
    await expect(page.getByTestId('swimlane')).toBeVisible({ timeout: 30_000 });
    await expect(page.getByTestId('swimlane-canvas')).toBeVisible();
    await expect(page.getByTestId('pipe-occupancy')).toBeVisible();
    await expect(page.getByTestId('stats-summary')).toBeVisible();
    // No error: the 160-byte container parsed and adapted in-browser.
    await expect(page.getByTestId('load-error')).toHaveCount(0);
  });

  test('PR-E2E-002: hover shows tooltip (UX S3)', async ({ page }) => {
    await page.goto('/');
    const canvas = page.getByTestId('swimlane-canvas');
    await expect(canvas).toBeVisible({ timeout: 15_000 });
    const box = await canvas.boundingBox();
    expect(box).toBeTruthy();
    expect(
      await probeSwimlane(page, box!, { action: 'move', expectTestId: 'event-tooltip' }),
    ).toBe(true);
    await expect(page.getByTestId('event-tooltip')).toBeVisible();
  });

  test('PR-E2E-003: click selects event (UX S3)', async ({ page }) => {
    await page.goto('/');
    const canvas = page.getByTestId('swimlane-canvas');
    await expect(canvas).toBeVisible({ timeout: 15_000 });
    const box = await canvas.boundingBox();
    expect(box).toBeTruthy();
    expect(
      await probeSwimlane(page, box!, { action: 'click', expectTestId: 'detail-panel' }),
    ).toBe(true);
    await expect(page.getByTestId('detail-panel')).toBeVisible();
  });

  test('PR-E2E-004: zoom-to-fit toolbar (UX S2)', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByTestId('report-toolbar')).toBeVisible({ timeout: 15_000 });
    await page.getByTestId('zoom-in').click();
    await page.getByTestId('zoom-to-fit').click();
    await expect(page.getByTestId('swimlane-canvas')).toBeVisible();
  });

  test('PR-E2E-005: standalone Chrome Trace hides aside (PROC-3)', async ({ page }) => {
    await page.goto('/?fixture=ffn_dense');
    await expect(page.getByTestId('playground-ready')).toBeVisible();
    await expect(page.getByTestId('swimlane')).toBeVisible({ timeout: 30_000 });
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
    await expect(page.getByTestId('cursor-label')).toHaveText(/^[\d][\d. ]*\s+(ms|µs|ns|s)$/);
  });

  test('PR-E2E-007: Chromium WebGL paints ffn_dense dependency curves', async ({ page }) => {
    test.setTimeout(120_000);
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

    // Data-bounded fit: scan many lanes × x offsets until a linked event paints curves.
    expect(
      await probeSwimlaneDepCurves(page, gl, box!, {
        maxLanes: 40,
        xOffsetsPx: [8, 24, 48, 80, 120, 160, 220, 280, 360, 480, 600],
        paintTimeoutMs: 250,
      }),
    ).toBe(true);

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

  test('PR-E2E-008: measure toggle activates and retints its masked design icon', async ({ page }) => {
    await page.goto('/');
    const btn = page.getByTestId('toggle-measure');
    await expect(btn).toBeVisible({ timeout: 15_000 });
    await btn.click();
    await expect(btn).toHaveAttribute('aria-pressed', 'true');
    await expect(btn).toHaveClass(/pr-toolbar__icon-btn--on/);

    const icon = btn.locator('.pr-icon--measure');
    await expect(icon).toHaveCount(1);
    const paint = (): Promise<{ mask: string; box: string; tint: string }> =>
      icon.evaluate((el) => {
        const s = getComputedStyle(el);
        return {
          mask: s.maskImage === 'none' ? s.webkitMaskImage : s.maskImage,
          box: `${s.width} ${s.height}`,
          tint: s.backgroundColor,
        };
      });

    // Hover tints the button the same blue as the active state, so park the pointer
    // before sampling or both reads come back identical.
    const parked = async (): Promise<{ mask: string; box: string; tint: string }> => {
      await page.mouse.move(0, 0);
      return paint();
    };

    const on = await parked();
    expect(on.mask).toMatch(/^url\(/);
    expect(on.box).toBe('16px 16px');

    await btn.click();
    await expect(btn).toHaveAttribute('aria-pressed', 'false');
    const off = await parked();
    // One glyph tinted through currentColor is the whole point of masking: the
    // artwork must not change between states, only its colour.
    expect(off.mask).toBe(on.mask);
    expect(off.tint).not.toBe(on.tint);
  });

  test('PR-E2E-009: Relevent chips fill their track so curves start at the chip edge', async ({
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
    const inCount = page.getByTestId('detail-relevant-incoming-count');
    expect(
      await probeSwimlane(page, box!, {
        action: 'click',
        expectTestId: 'detail-panel',
        maxLanes: 8,
        predicate: async () =>
          (await inCount.count()) > 0 && Number(await inCount.innerText()) >= 2,
      }),
    ).toBe(true);

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

  test('PR-E2E-010: expanding the dock grows its columns with it', async ({ page }) => {
    // The body was content-sized, so it kept its ~212px whatever height the dock had:
    // the identity card stopped short and the rest was dead space. Only a real layout
    // engine sees this — jsdom reports zero-height boxes.
    await page.setViewportSize({ width: 1600, height: 900 });
    await page.goto('/?fixture=deps');
    await expect(page.getByTestId('playground-ready')).toBeVisible();
    const overlay = page.getByTestId('swimlane-canvas');
    await expect(overlay).toBeVisible({ timeout: 15_000 });
    const box = (await overlay.boundingBox())!;

    await page.mouse.click(box.x + 106, box.y + LANE_GROUP_HEADER_HEIGHT + LANE_HEIGHT / 2);
    const panel = page.getByTestId('detail-panel');
    await expect(panel).toBeVisible();

    const heights = async () =>
      page.evaluate(() =>
        ['.pr-detail-panel', '.pr-detail-panel__body', '.pr-detail-summary'].map(
          (sel) => document.querySelector(sel)!.getBoundingClientRect().height,
        ),
      );
    // The dock animates in, so a baseline taken on `toBeVisible` catches it mid-slide.
    const settledAt = (h: number) =>
      expect.poll(async () => (await heights())[0], { timeout: 2000 }).toBe(h);
    await settledAt(DOCK_HEIGHT_COLLAPSED);
    const [dock0, body0] = await heights();

    await page.getByTestId('detail-panel-expander').click();
    await settledAt(DOCK_HEIGHT_EXPANDED);

    const [dock1, body1, card1] = await heights();
    expect(dock1).toBeGreaterThan(dock0 + 100);
    // The body has to follow the dock, and the card has to fill the body.
    expect(body1).toBeGreaterThan(body0 + 100);
    expect(dock1 - body1).toBeCloseTo(dock0 - body0, 0);
    expect(card1).toBeGreaterThan(body1 - 40);
  });
});
