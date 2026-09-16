import { test, expect, type Locator } from '@playwright/test';

/**
 * PR-MEMTOP-013's geometry, which no unit test can reach: jsdom has no layout, so the ratio of the
 * fit box to the diagram, and the distance the box can be panned, are only observable in a browser.
 *
 * The panel renders in two hosts with different pixel budgets — the stacked aside (a box that
 * already has the chrome's ratio) and the wide fullscreen overlay — and the invariant has to hold in
 * both: the *drawing* keeps 448:540, the fitted scale fills the box it was given, and the scroll
 * range covers exactly the diagram's own overflow rather than empty stage.
 */

const CHROME_W = 448;
const CHROME_H = 540;
/** `scrollWidth` reports an integer, and the diagram's own edges land on fractions. */
const SLOP = 2;

/**
 * The diagram's on-screen rectangle, mapped from chrome units (0,0)–(448,540) through the `svg`'s own
 * CTM — the *drawing*, not the `svg` element around it, which letterboxes under
 * `preserveAspectRatio` when the element and the viewBox disagree.
 */
async function probe(panel: Locator) {
  return panel.evaluate((root, chrome) => {
    const viewport = root.querySelector('.pr-topo__viewport') as HTMLElement;
    const svg = root.querySelector('.pr-topo__svg') as SVGSVGElement;
    const ctm = svg.getScreenCTM()!;
    const map = (x: number, y: number) => ({
      x: ctm.a * x + ctm.c * y + ctm.e,
      y: ctm.b * x + ctm.d * y + ctm.f,
    });
    const tl = map(0, 0);
    const br = map(chrome.w, chrome.h);
    const box = viewport.getBoundingClientRect();
    const inkW = br.x - tl.x;
    const inkH = br.y - tl.y;
    return {
      box: { w: box.width, h: box.height },
      ink: { w: inkW, h: inkH },
      inkRatio: inkW / inkH,
      /** Fitted = the drawing reaches the box on at least one axis without overhanging either. */
      fitsInside: inkW <= box.width + chrome.slop && inkH <= box.height + chrome.slop,
      touchesBox: inkW >= box.width - chrome.slop || inkH >= box.height - chrome.slop,
      /**
       * The drawing's own excess over the *client* box — the distance panning has to cover. Both
       * sides are in the client box on purpose: `scrollWidth - clientWidth` is measured without a
       * classic scrollbar's width, so comparing it against the *border* box would differ by the
       * scrollbar (~15px) on platforms that reserve it, and Chromium's overlay scrollbars here
       * would hide that. In the client box the two agree either way.
       */
      panX: Math.max(0, inkW - viewport.clientWidth),
      panY: Math.max(0, inkH - viewport.clientHeight),
      /** What the box can actually be scrolled by. */
      scrollX: viewport.scrollWidth - viewport.clientWidth,
      scrollY: viewport.scrollHeight - viewport.clientHeight,
      /** What the bars reserve: inline-end for the vertical one, block-end for the horizontal. */
      gutterX: Math.round(box.width - viewport.clientWidth),
      gutterY: Math.round(box.height - viewport.clientHeight),
    };
  }, { w: CHROME_W, h: CHROME_H, slop: SLOP });
}

const barBackground = (panel: Locator) =>
  panel.evaluate(
    (root) => getComputedStyle(root.querySelector('.pr-topo__bar')!).backgroundColor,
  );

test('PR-MEMTOP-013: each host fits the diagram, and pans it by its own overflow', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1600, height: 900 });
  await page.goto('/?fixture=sample&renderer=canvas');

  const aside = page.locator('[data-testid="stats-topology"] [data-testid="memory-topology-panel"]');
  await expect(aside).toBeVisible();

  // Fitted: the drawing is the chrome's ratio, it fills the box it was given, and the box is not a
  // scroll container at all (PR-MEMTOP-015's stray-scrollbar rule).
  const asideFitted = await probe(aside);
  expect(asideFitted.inkRatio).toBeCloseTo(CHROME_W / CHROME_H, 2);
  expect(asideFitted.fitsInside).toBe(true);
  expect(asideFitted.touchesBox).toBe(true);
  expect(asideFitted.scrollX).toBe(0);
  expect(asideFitted.scrollY).toBe(0);

  // Past the fit, panning is the platform's scroll — and it covers the diagram, not a letterbox.
  await aside.getByTestId('topology-zoom-in').click();
  const asideZoomed = await probe(aside);
  expect(asideZoomed.inkRatio).toBeCloseTo(CHROME_W / CHROME_H, 2);
  expect(Math.abs(asideZoomed.scrollX - asideZoomed.panX)).toBeLessThanOrEqual(SLOP);
  expect(Math.abs(asideZoomed.scrollY - asideZoomed.panY)).toBeLessThanOrEqual(SLOP);

  // Both sides of that comparison are in the *client* box, because `scrollWidth - clientWidth`
  // excludes a classic scrollbar while the border box includes it. Chromium's overlay scrollbars
  // reserve nothing, which would hide a mismatch — `scrollbar-gutter: stable` reserves the gutter
  // regardless, so the reserving regime (Windows / a stable gutter) is exercised rather than
  // assumed. Against the border box this step is off by exactly the gutter.
  await page.addStyleTag({
    content: '.pr-topo__viewport--pannable { scrollbar-gutter: stable; }',
  });
  const asideReserved = await probe(aside);
  // Only the inline gutter has a CSS switch — the vertical bar — so the block-end gutter stays 0.
  expect(asideReserved.gutterX).toBeGreaterThan(0);
  expect(Math.abs(asideReserved.scrollX - asideReserved.panX)).toBeLessThanOrEqual(SLOP);
  expect(Math.abs(asideReserved.scrollY - asideReserved.panY)).toBeLessThanOrEqual(SLOP);

  // The overlay is the wide host: its box is the leftover area, far wider than the diagram, so a
  // stage that followed the box would let the pan travel through empty space on both sides.
  await aside.getByTestId('topology-fullscreen').click();
  const overlay = page.locator(
    '[data-testid="topology-fullscreen-overlay"] [data-testid="memory-topology-panel"]',
  );
  await expect(overlay).toBeVisible();

  const overlayFitted = await probe(overlay);
  expect(overlayFitted.box.w).toBeGreaterThan(overlayFitted.box.h * 1.5);
  expect(overlayFitted.inkRatio).toBeCloseTo(CHROME_W / CHROME_H, 2);
  expect(overlayFitted.fitsInside).toBe(true);
  expect(overlayFitted.touchesBox).toBe(true);
  expect(overlayFitted.scrollX).toBe(0);
  expect(overlayFitted.scrollY).toBe(0);

  await overlay.getByTestId('topology-zoom-in').click();
  const overlayZoomed = await probe(overlay);
  expect(overlayZoomed.inkRatio).toBeCloseTo(CHROME_W / CHROME_H, 2);
  expect(Math.abs(overlayZoomed.scrollX - overlayZoomed.panX)).toBeLessThanOrEqual(SLOP);
  expect(Math.abs(overlayZoomed.scrollY - overlayZoomed.panY)).toBeLessThanOrEqual(SLOP);
});

test('PR-MEMTOP-014: the overlay drops the bar strip the aside keeps', async ({ page }) => {
  await page.setViewportSize({ width: 1600, height: 900 });
  await page.goto('/?fixture=sample&renderer=canvas');

  const aside = page.locator('[data-testid="stats-topology"] [data-testid="memory-topology-panel"]');
  await expect(aside).toBeVisible();
  expect(await barBackground(aside)).toBe('rgb(49, 49, 49)');

  await aside.getByTestId('topology-fullscreen').click();
  const overlay = page.locator(
    '[data-testid="topology-fullscreen-overlay"] [data-testid="memory-topology-panel"]',
  );
  await expect(overlay).toBeVisible();
  // The export's fullscreen frame has no `#313131` lift: the controls sit straight on the card.
  expect(await barBackground(overlay)).toBe('rgba(0, 0, 0, 0)');
});

/**
 * PR-MEMTOP-017's drag is a gesture over a real scroll container: the pointer must move the box's
 * own `scrollLeft`/`scrollTop`, which only a browser can show. The maths is unit-tested
 * (`MemoryTopologyPanel.spec.ts`); what this covers is that a press on the diagram reaches the
 * handler at all, that the grab cursor follows the gesture, and that 100% is not draggable.
 */
test('PR-MEMTOP-017: dragging the zoomed diagram pans it', async ({ page }) => {
  await page.setViewportSize({ width: 1600, height: 900 });
  await page.goto('/?fixture=sample&renderer=canvas');

  const aside = page.locator('[data-testid="stats-topology"] [data-testid="memory-topology-panel"]');
  const viewport = aside.getByTestId('topology-viewport');
  await expect(viewport).toBeVisible();

  const scroll = () => viewport.evaluate((el) => ({ x: el.scrollLeft, y: el.scrollTop }));
  const cursor = () => viewport.evaluate((el) => getComputedStyle(el).cursor);
  /** Press in the box at a fraction of its size, drag by (dx, dy), release; returns the cursor
   *  seen mid-gesture. */
  const drag = async (dx: number, dy: number, at = { x: 0.5, y: 0.5 }) => {
    await viewport.scrollIntoViewIfNeeded();
    const box = (await viewport.boundingBox())!;
    const from = { x: box.x + box.width * at.x, y: box.y + box.height * at.y };
    await page.mouse.move(from.x, from.y);
    await page.mouse.down();
    await page.mouse.move(from.x + dx, from.y + dy, { steps: 5 });
    const during = await cursor();
    await page.mouse.up();
    return during;
  };

  // Fitted: nothing to pan, and no grab affordance either (PR-MEMTOP-013/017).
  expect(await cursor()).not.toBe('grab');
  await drag(-40, -30);
  expect(await scroll()).toEqual({ x: 0, y: 0 });

  // 200%: the box has its own width and height of drawing to travel through, both axes.
  for (let i = 0; i < 3; i++) await aside.getByTestId('topology-zoom-in').click();
  expect(await cursor()).toBe('grab');
  expect(await drag(-40, -30)).toBe('grabbing');

  const panned = await scroll();
  expect(Math.abs(panned.x - 40)).toBeLessThanOrEqual(SLOP);
  expect(Math.abs(panned.y - 30)).toBeLessThanOrEqual(SLOP);

  // Already panned, and pressed near the box's own right edge: still the drawing's gesture. A
  // scrollbar test measured from Chromium's `offsetX` (which is reported against the *content* and
  // so walks with the pan) reads this press as a thumb and drops the drag — hence the box-relative
  // one the component uses (PR-MEMTOP-017).
  expect(await drag(-30, 0, { x: 0.95, y: 0.5 })).toBe('grabbing');
  const pannedAgain = await scroll();
  expect(Math.abs(pannedAgain.x - 70)).toBeLessThanOrEqual(SLOP);
  expect(Math.abs(pannedAgain.y - 30)).toBeLessThanOrEqual(SLOP);

  // The native bars are still there, and 适应窗口 still returns to the origin.
  await aside.getByTestId('topology-zoom-fit').click();
  expect(await scroll()).toEqual({ x: 0, y: 0 });
});
