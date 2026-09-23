import { test, expect, type Page } from '@playwright/test';
import { LANE_GROUP_HEADER_HEIGHT, LANE_HEIGHT } from '../../src/swimlane/CanvasSwimlaneRenderer';
import { DOCK_HEIGHT_COLLAPSED, DOCK_HEIGHT_EXPANDED } from '../../src/ui/panelResize';

/** With fit = [minTime, maxTime], events fill the canvas; probe near the left first. */
const EVENT_X_FRACTIONS = [0.02, 0.05, 0.1, 0.15, 0.2, 0.35, 0.5, 0.65, 0.8];

type CanvasBox = { x: number; y: number; width: number; height: number };

function xOffsets(box: CanvasBox, fractions: number[]): number[] {
  return fractions.map((f) => Math.min(Math.round(f * box.width), box.width - 4));
}

/** Scrollable 统计分析 block overlays the canvas top (contentTopPad). */
async function overviewTopPad(page: Page): Promise<number> {
  const ov = page.getByTestId('overview-charts');
  if ((await ov.count()) === 0) return 0;
  const b = await ov.boundingBox();
  return b?.height ?? 0;
}


/**
 * Marquee over the deps fixture's first two ProfilerStep events (same lane).
 * Must reach ~step-2 start (~19% of the fit window); a short x-drag only hits one event
 * and demotes to DetailPanel instead of MultiSelectSummary.
 */
async function marqueeDepsMultiSelect(page: Page): Promise<{
  overlay: ReturnType<Page['getByTestId']>;
  box: CanvasBox;
  laneY: number;
}> {
  const overlay = page.getByTestId('swimlane-canvas');
  await expect(overlay).toBeVisible({ timeout: 15_000 });
  const box = (await overlay.boundingBox())!;
  const topPad = await overviewTopPad(page);
  const laneY = box.y + topPad + LANE_GROUP_HEADER_HEIGHT + LANE_HEIGHT / 2;
  const endX = box.x + Math.max(420, Math.round(box.width * 0.35));
  await page.mouse.move(box.x + 8, laneY);
  await page.mouse.down();
  await page.mouse.move(endX, laneY + LANE_HEIGHT, { steps: 12 });
  return { overlay, box, laneY };
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
  const topPad = await overviewTopPad(page);
  for (let lane = 0; lane < maxLanes; lane++) {
    const y = box.y + topPad + LANE_GROUP_HEADER_HEIGHT + lane * LANE_HEIGHT + LANE_HEIGHT / 2;
    if (y > box.y + box.height - 2) break;
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
  const topPad = await overviewTopPad(page);
  for (let lane = 0; lane < maxLanes; lane++) {
    const y = box.y + topPad + LANE_GROUP_HEADER_HEIGHT + lane * LANE_HEIGHT + LANE_HEIGHT / 2;
    if (y > box.y + box.height - 2) break;
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
    await expect(page.getByTestId('swimlane').first()).toBeVisible({ timeout: 30_000 });
    await expect(page.getByTestId('swimlane-canvas')).toBeVisible();
    await expect(page.getByTestId('pipe-occupancy')).toBeVisible();
    // sample.lite.rep embeds Sampling.json (CUBE/VECTOR) → overview tracks (DATA-39).
    await expect(page.getByTestId('overview-charts')).toBeVisible();
    await expect(page.locator('[data-testid="overview-charts"] [data-series-id="CUBE"]')).toBeVisible();
  });

  test('PR-E2E-011: playground loads the product 160-byte npu-rep sample (in-browser parse)', async ({ page }) => {
    await page.goto('/?fixture=npu160');
    await expect(page.getByTestId('playground-ready')).toBeVisible();
    await expect(page.getByTestId('swimlane').first()).toBeVisible({ timeout: 30_000 });
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
    await expect(page.getByTestId('swimlane').first()).toBeVisible({ timeout: 30_000 });
    await expect(page.getByTestId('pipe-occupancy')).toHaveCount(0);
    await expect(page.getByTestId('stats-summary')).toHaveCount(0);
    // Trace-only still shows task/util gutter bars from events (no pipe CSV).
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
    const topPad = await overviewTopPad(page);
    await page.mouse.move(
      box!.x + 40,
      box!.y + topPad + LANE_GROUP_HEADER_HEIGHT + LANE_HEIGHT / 2,
    );
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
    const swim = page.getByTestId('swimlane').first();
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
    // Read the count via evaluate — locator.innerText() waits for visibility and can
    // burn the whole test timeout when the badge is in the DOM but not actionable yet
    // (dock animating / scrolled).
    const inCount = page.getByTestId('detail-relevant-incoming-count');
    expect(
      await probeSwimlane(page, box!, {
        action: 'click',
        expectTestId: 'detail-panel',
        maxLanes: 8,
        predicate: async () => {
          if ((await inCount.count()) === 0) return false;
          // textContent waits for attached (not visible). A short timeout turns a detached
          // race into TimeoutError → false so the probe keeps scanning (timeout: 0 means
          // wait forever in Playwright — do not use it here).
          try {
            const text = await inCount.textContent({ timeout: 1000 });
            return text != null && Number(text) >= 2;
          } catch {
            return false;
          }
        },
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
    const topPad = await overviewTopPad(page);

    await page.mouse.click(
      box.x + 106,
      box.y + topPad + LANE_GROUP_HEADER_HEIGHT + LANE_HEIGHT / 2,
    );
    const panel = page.getByTestId('detail-panel');
    await expect(panel).toBeVisible();

    const heights = async () =>
      page.evaluate(() =>
        ['.pr-dock', '.pr-detail-panel__body', '.pr-detail-summary'].map(
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

  test('PR-E2E-011: drag marquees real events into the multi-select dock', async ({
    page,
  }) => {
    // Real pointer + layout: jsdom fakes both, so only Chromium proves the rect the user
    // drags matches the blocks the renderer actually painted.
    await page.setViewportSize({ width: 1600, height: 900 });
    await page.goto('/?fixture=deps');
    await expect(page.getByTestId('playground-ready')).toBeVisible();
    await marqueeDepsMultiSelect(page);
    // Mid-drag the rect must be visible; the tooltip must not.
    await expect(page.getByTestId('marquee-rect')).toBeVisible();
    await expect(page.getByTestId('event-tooltip')).toHaveCount(0);
    // Live dock follows coverage before commit (≥2 events → summary).
    await expect(page.getByTestId('dock')).toBeVisible();
    await expect(page.getByTestId('multi-select-summary')).toBeVisible();
    await expect(page.locator('.pr-multi-select__table')).toHaveCount(0);
    // Δt chrome tracks the live rect (measure parity), with measure mode off.
    await expect(page.getByTestId('measure-arrow')).toBeVisible();
    await page.mouse.up();

    const dock = page.getByTestId('multi-select-summary');
    await expect(dock).toBeVisible();
    await expect(page.getByTestId('marquee-rect')).toHaveCount(0);
    // Δt is cleared on commit; only the live drag showed the measure chrome.
    await expect(page.getByTestId('measure-arrow')).toHaveCount(0);
    // The shared dock shell shows multi-select content; single-select DetailPanel is hidden.
    await expect(page.getByTestId('detail-panel')).toHaveCount(0);

    const tabText = await page.getByTestId('multi-select-tab').textContent();
    const selected = Number(/Slices \((\d+)\)/.exec(tabText ?? '')?.[1]);
    expect(selected).toBeGreaterThan(0);
    const rows = page.locator('[data-testid^="multi-select-row-"]');
    const count = await rows.count();
    expect(count).toBeGreaterThan(0);
    expect(count).toBeLessThanOrEqual(selected);

    // Table-cell `height` is a CSS minimum; the metric chip must still fit 29px
    // or the ranked-window scrollTop / ROW_HEIGHT_PX math drifts.
    const rowHeight = await rows.first().evaluate((el) => el.getBoundingClientRect().height);
    expect(rowHeight).toBe(29);

    // Bars are laid out by the real engine: the longest row fills its track.
    const widths = await page.evaluate(() =>
      [...document.querySelectorAll('.pr-multi-select__bar-fill')].map((el) => {
        const fill = el.getBoundingClientRect().width;
        const track = el.parentElement!.getBoundingClientRect().width;
        return track > 0 ? fill / track : -1;
      }),
    );
    expect(widths.length).toBeGreaterThan(0);
    expect(Math.max(...widths)).toBeCloseTo(1, 1);
    for (const w of widths) expect(w).toBeGreaterThanOrEqual(0);

    // Name click hands off to single-select.
    await page.locator('.pr-multi-select__name').first().click();
    await expect(page.getByTestId('detail-panel')).toBeVisible();
    await expect(dock).toHaveCount(0);
  });

  test('PR-E2E-013: closing the dock frees the swimlane while the dock slides away', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1600, height: 900 });
    await page.goto('/?fixture=deps');
    await expect(page.getByTestId('playground-ready')).toBeVisible();
    const { overlay } = await marqueeDepsMultiSelect(page);
    await page.mouse.up();
    await expect(page.getByTestId('multi-select-summary')).toBeVisible();

    const wrapBeforeLeave = await overlay.evaluate((canvas) =>
      (canvas.closest('[data-testid="swimlane"]') as HTMLElement).clientHeight,
    );
    await page.getByTestId('multi-select-close').click();

    // Vue's leave element is still mounted, but it must no longer reserve the
    // dock's flex slot; otherwise the root background is exposed as a blank box.
    const dock = page.getByTestId('dock');
    await expect(dock).toHaveCSS('position', 'absolute');
    await expect
      .poll(() =>
        overlay.evaluate((canvas) =>
          (canvas.closest('[data-testid="swimlane"]') as HTMLElement).clientHeight,
        ),
      )
      .toBeGreaterThan(wrapBeforeLeave + 100);
    await expect(dock).toHaveCount(0);
    await expect(overlay).toBeVisible();
  });

  test('PR-E2E-014: dock enter grows layout height with the timeline (no black-hole slot)', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1600, height: 900 });
    await page.goto('/?fixture=deps');
    await expect(page.getByTestId('playground-ready')).toBeVisible();
    const overlay = page.getByTestId('swimlane-canvas');
    await expect(overlay).toBeVisible({ timeout: 15_000 });
    const box = (await overlay.boundingBox())!;
    const topPad = await overviewTopPad(page);

    // Slow the enter so a mid-flight sample is reliable; leave absolute slide unchanged.
    await page.addStyleTag({
      content: `
        .pr-dock-enter-active {
          transition: height 2000ms linear !important, opacity 2000ms linear !important;
        }
      `,
    });

    const swimBefore = await overlay.evaluate(
      (canvas) => (canvas.closest('[data-testid="swimlane"]') as HTMLElement).clientHeight,
    );

    await page.mouse.click(
      box.x + 106,
      box.y + topPad + LANE_GROUP_HEADER_HEIGHT + LANE_HEIGHT / 2,
    );
    const dock = page.getByTestId('dock');
    await expect(dock).toBeVisible();

    // Sample while height is still climbing — must not already reserve the full dock.
    await expect
      .poll(async () => {
        const sample = await page.evaluate(() => {
          const d = document.querySelector('[data-testid="dock"]') as HTMLElement | null;
          const s = document.querySelector('[data-testid="swimlane"]') as HTMLElement | null;
          if (!d || !s) return null;
          return { dockH: d.getBoundingClientRect().height, swimH: s.clientHeight };
        });
        return sample;
      })
      .not.toBeNull();

    const mid = await page.evaluate(() => {
      const d = document.querySelector('[data-testid="dock"]') as HTMLElement;
      const s = document.querySelector('[data-testid="swimlane"]') as HTMLElement;
      return { dockH: d.getBoundingClientRect().height, swimH: s.clientHeight };
    });

    // Catch the regression: full-height reserved slot + translateY left swim shrunk by
    // ~DOCK_HEIGHT while dock layout height was already final. Mid-enter must couple them.
    expect(mid.dockH).toBeLessThan(DOCK_HEIGHT_COLLAPSED * 0.6);
    expect(swimBefore - mid.swimH).toBeLessThan(DOCK_HEIGHT_COLLAPSED * 0.6 + 40);
    // Layout shrink tracks the dock's current layout height (not a pre-claimed full slot).
    expect(Math.abs(swimBefore - mid.swimH - mid.dockH)).toBeLessThan(48);

    await expect
      .poll(async () => (await dock.boundingBox())?.height ?? 0, { timeout: 3000 })
      .toBe(DOCK_HEIGHT_COLLAPSED);
  });

  test('PR-E2E-012: Escape cancels a marquee mid-drag and clears a committed one', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1600, height: 900 });
    await page.goto('/?fixture=deps');
    await expect(page.getByTestId('playground-ready')).toBeVisible();
    const overlay = page.getByTestId('swimlane-canvas');
    await expect(overlay).toBeVisible({ timeout: 15_000 });
    const box = (await overlay.boundingBox())!;
    const topPad = await overviewTopPad(page);
    const laneY = box.y + topPad + LANE_GROUP_HEADER_HEIGHT + LANE_HEIGHT / 2;

    // Seed a single selection so Escape mid-drag must restore DetailPanel.
    await page.mouse.click(box.x + 40, laneY);
    await expect(page.getByTestId('detail-panel')).toBeVisible();

    // Cancelled mid-drag: live summary appears, Escape restores prior DetailPanel.
    await marqueeDepsMultiSelect(page);
    await expect(page.getByTestId('multi-select-summary')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByTestId('marquee-rect')).toHaveCount(0);
    await page.mouse.up();
    await expect(page.getByTestId('multi-select-summary')).toHaveCount(0);
    await expect(page.getByTestId('detail-panel')).toBeVisible();
    await expect(page.getByTestId('measure-arrow')).toHaveCount(0);

    // Committed, then cleared by Escape — the axis Δt goes with it.
    await marqueeDepsMultiSelect(page);
    await page.mouse.up();
    await expect(page.getByTestId('multi-select-summary')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByTestId('multi-select-summary')).toHaveCount(0);
    await expect(page.getByTestId('detail-panel')).toHaveCount(0);
    await expect(page.getByTestId('measure-arrow')).toHaveCount(0);
  });
});

type SummaryProbe = {
  /** Used grid tracks — 2 for the sketch 2×2, 1 once the well drops under the documented 430px. */
  cols: number;
  /** Content box of the scroll body: the container the summary grid queries. */
  well: number;
  /** Card label / duration secondary text wider than its own box (the old paint-outside-tile bug). */
  overflowing: string[];
  /** Column labels cut by their own box — `text-overflow: ellipsis` paints the cue. Fine when titled. */
  ellipsized: string[];
  /** Column labels hard-clipped by an ancestor instead — no cue, the pre-fix bug shape. Never allowed. */
  ancestorClipped: string[];
  /** Column labels cut with no `title` — a silent crop, never allowed. */
  cropped: string[];
  /** Column labels with no `title` at all, cut or not — the spec's floor is unconditional. */
  untitled: string[];
};

/**
 * Geometry-only probe: jsdom cannot measure wrapping or ellipsis, so this reads real layout boxes
 * from the mounted aside.
 */
async function probeSummary(page: Page): Promise<SummaryProbe> {
  return page.evaluate(() => {
    const summary = document.querySelector('[data-testid="stats-summary"]');
    if (!summary) throw new Error('stats-summary not mounted');
    const body = document.querySelector('.pr-aside__body');
    const textOf = (el: Element) => (el.textContent ?? '').trim();
    const overflows = (el: Element) => el.scrollWidth > el.clientWidth + 1;
    /** Text run width, independent of the box that happens to be clipping it. */
    const textRun = (el: Element) => {
      const range = document.createRange();
      range.selectNodeContents(el);
      return range.getBoundingClientRect().width;
    };

    const overflowing: string[] = [];
    summary.querySelectorAll('.pr-card__label, .pr-card__sub').forEach((el) => {
      if (overflows(el)) overflowing.push(textOf(el));
    });

    const ellipsized: string[] = [];
    const ancestorClipped: string[] = [];
    const cropped: string[] = [];
    const untitled: string[] = [];
    summary.querySelectorAll('.pr-bw-col').forEach((col) => {
      col.querySelectorAll('.pr-bw-col__side').forEach((el) => {
        const title = el.getAttribute('title');
        if (!title) untitled.push(textOf(el));
        if (overflows(el)) {
          // The span is its own clipping box, so the browser paints the ellipsis: a visible cue.
          (title ? ellipsized : cropped).push(textOf(el));
        } else if (textRun(el) > col.clientWidth + 1) {
          // Fits its own box but not the column: an ancestor `overflow: hidden` hard-cuts it with
          // no ellipsis and no cue — the exact shape this PR removed.
          ancestorClipped.push(textOf(el));
          if (!title) cropped.push(textOf(el));
        }
      });
    });

    return {
      cols: getComputedStyle(summary).gridTemplateColumns.split(' ').filter(Boolean).length,
      well: body?.clientWidth ?? 0,
      overflowing,
      ellipsized,
      ancestorClipped,
      cropped,
      untitled,
    };
  });
}

/** PR-STATS-036's documented collapse threshold (content well, px). */
const SUMMARY_COLLAPSE_MAX_WELL = 430;

test.describe('PR-STATS-036 summary tiles at resized widths', () => {
  // `en` has the longest column label ("Parallel utilization"); zh-CN is the default shell.
  for (const [locale, url] of [
    ['zh', '/'],
    ['en', '/?locale=en'],
  ] as const) {
    test(`PR-STATS-036: ${locale} tile text stays readable as the aside narrows`, async ({ page }) => {
      const sides = page.locator('[data-testid="stats-summary"] .pr-bw-col__side');

      // Default aside (480px): sketch 2×2, no card text outside its own box.
      await page.setViewportSize({ width: 1600, height: 900 });
      await page.goto(url);
      await expect(page.getByTestId('playground-ready')).toBeVisible();
      // The summary hydrates once the sample report loads, as in the sibling feature paths.
      await expect(page.getByTestId('stats-summary')).toBeVisible({ timeout: 30_000 });
      await expect(sides.first()).toBeVisible({ timeout: 30_000 });

      const wide = await probeSummary(page);
      // The track count follows the documented threshold, so a Product change to it fails here.
      expect(wide.cols, `well ${wide.well}px vs the ${SUMMARY_COLLAPSE_MAX_WELL}px threshold`).toBe(
        wide.well > SUMMARY_COLLAPSE_MAX_WELL ? 2 : 1,
      );
      expect(wide.overflowing, 'card label / duration secondary must wrap inside the tile').toEqual([]);
      expect(wide.untitled, 'every column label carries its full text in `title`').toEqual([]);
      expect(
        wide.ancestorClipped,
        'a cut label must be cut by its own ellipsis, never hard-clipped by an ancestor',
      ).toEqual([]);
      expect(wide.cropped, 'a cut column label must carry its full text in `title`').toEqual([]);

      // `en` is the widest case: at 2 columns its long label is genuinely cut, so the ellipsis +
      // `title` path above is exercised rather than passing vacuously.
      if (locale === 'en' && wide.cols === 2) {
        expect(wide.ellipsized).toContain('Parallel utilization');
      }

      // Aside at its 280px minimum: the grid collapses, so nothing needs an ellipsis at all.
      await page.setViewportSize({ width: 820, height: 900 });
      await expect
        .poll(async () => (await probeSummary(page)).cols, { timeout: 10_000 })
        .toBe(1);

      const narrow = await probeSummary(page);
      expect(
        narrow.well,
        'a 820px host must squeeze the aside under the collapse threshold',
      ).toBeLessThanOrEqual(SUMMARY_COLLAPSE_MAX_WELL);
      expect(narrow.overflowing).toEqual([]);
      expect(narrow.ellipsized, 'one tile per row gives every column label the full well width').toEqual([]);
      expect(narrow.ancestorClipped).toEqual([]);
      expect(narrow.cropped).toEqual([]);
      expect(narrow.untitled).toEqual([]);
    });
  }

  test('PR-STATS-036: a long label or secondary wraps instead of spilling', async ({ page }) => {
    await page.setViewportSize({ width: 1600, height: 900 });
    await page.goto('/?locale=en');
    await expect(page.getByTestId('playground-ready')).toBeVisible();
    await expect(page.getByTestId('stats-summary')).toBeVisible({ timeout: 30_000 });

    /*
     * No fixture carries a label long enough to wrap inside the 2×2, so the wrap rule would pass
     * vacuously. Stress it with the two shapes it exists for: a long card label, and DATA-1's
     * duration-secondary `opName` fallback — underscores, so no break opportunity at all.
     */
    const measured = await page.evaluate(() => {
      const sub = document.querySelector<HTMLElement>('[data-testid="stats-duration-secondary"]');
      const label = document.querySelector<HTMLElement>('.pr-card__label');
      if (!sub || !label) throw new Error('duration card not mounted');
      sub.textContent = 'ReduceSum_MatMul_V2_fused_attention_score_split_0_0_1_0_0_0_0_reduce';
      label.textContent = 'AICore parallel utilization across every launched core in this block';
      const box = (el: HTMLElement) => ({
        scrollW: el.scrollWidth,
        clientW: el.clientWidth,
        h: el.getBoundingClientRect().height,
      });
      return { sub: box(sub), label: box(label) };
    });

    // Wrapped, not clipped: the text stayed inside the box and the box grew taller to hold it.
    expect(measured.sub.scrollW).toBeLessThanOrEqual(measured.sub.clientW + 1);
    expect(measured.label.scrollW).toBeLessThanOrEqual(measured.label.clientW + 1);
    expect(measured.sub.h, 'the unbreakable secondary must gain lines').toBeGreaterThan(20);
    expect(measured.label.h, 'the long card label must gain lines').toBeGreaterThan(20);
  });
});
