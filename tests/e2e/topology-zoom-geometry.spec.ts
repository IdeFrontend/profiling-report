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
 * A step's own offset (PR-MEMTOP-018): `scrollLeft`/`scrollTop` start at the origin, so a drawing
 * that simply grew would do it away from the box's middle and the part being looked at would slide
 * off the corner. The step keeps the middle instead. The assertion is the middle of the visible box
 * in the *drawing's* own px, which is the same number at any scale — that is what "still looking at
 * the same place" means, and it is comparable across two steps whose drawings are different sizes.
 */
test('PR-MEMTOP-018: a zoom step keeps the middle on the same part of the drawing', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1600, height: 900 });
  await page.goto('/?fixture=sample&renderer=canvas');

  const aside = page.locator('[data-testid="stats-topology"] [data-testid="memory-topology-panel"]');
  const viewport = aside.getByTestId('topology-viewport');
  await expect(viewport).toBeVisible();

  /** The drawing's own point under the middle of the visible box, in the chrome's 448×540 units.
   *  Measured from the box's `clientWidth` because that is the visible width on a platform whose
   *  bars reserve a gutter, while the border box also counts the band they reserved. */
  const middle = () =>
    viewport.evaluate(
      (el, chrome) => {
        const box = el.getBoundingClientRect();
        const ink = el.querySelector('.pr-topo__stage')!.getBoundingClientRect();
        return {
          x: ((box.left + el.clientWidth / 2 - ink.left) / ink.width) * chrome.w,
          y: ((box.top + el.clientHeight / 2 - ink.top) / ink.height) * chrome.h,
        };
      },
      { w: CHROME_W, h: CHROME_H },
    );

  // Fitted, the whole drawing is in the box: its middle is the drawing's own middle.
  const fitted = await middle();
  expect(fitted.x).toBeCloseTo(CHROME_W / 2, 0);
  expect(fitted.y).toBeCloseTo(CHROME_H / 2, 0);

  await aside.getByTestId('topology-zoom-in').click();
  const stepped = await middle();
  expect(Math.abs(stepped.x - fitted.x)).toBeLessThanOrEqual(SLOP);
  expect(Math.abs(stepped.y - fitted.y)).toBeLessThanOrEqual(SLOP);

  // And it holds from an offset the step did not choose — both axes, and back down a stop. A tenth
  // of the range is deliberate: the middle of a 125% drawing sits within a quarter of its own width
  // of the edges, so a deeper offset would be clamped on the way back down and move the middle for
  // a reason that is not this rule.
  await viewport.evaluate((el) => {
    el.scrollLeft = el.scrollWidth * 0.1;
    el.scrollTop = el.scrollHeight * 0.1;
  });
  const panned = await middle();

  await aside.getByTestId('topology-zoom-in').click();
  const deeper = await middle();
  expect(Math.abs(deeper.x - panned.x)).toBeLessThanOrEqual(SLOP);
  expect(Math.abs(deeper.y - panned.y)).toBeLessThanOrEqual(SLOP);

  await aside.getByTestId('topology-zoom-out').click();
  const back = await middle();
  expect(Math.abs(back.x - panned.x)).toBeLessThanOrEqual(SLOP);
  expect(Math.abs(back.y - panned.y)).toBeLessThanOrEqual(SLOP);

  // Same rule in the wide overlay, whose box is a different *shape* — and there, X is letterboxed at
  // first: the stage is narrower than the box until the ladder reaches ~300%, so `scrollWidth` is the
  // box's own width and the anchor is the fitted `margin-inline: auto` case. The step that crosses
  // over is the one the aside cannot reach (its box is narrow enough that 125% overflows both axes):
  // the placement has to hand over from centring to a real scroll, and a regression that left the
  // stage left-aligned while `scrollLeft` stayed 0 would only show up here. So step the ladder until
  // X really does overflow, asserting the middle at every step, including the crossing one.
  await aside.getByTestId('topology-fullscreen').click();
  const overlay = page.locator(
    '[data-testid="topology-fullscreen-overlay"] [data-testid="memory-topology-panel"]',
  );
  const overlayViewport = overlay.getByTestId('topology-viewport');
  await expect(overlayViewport).toBeVisible();
  // The overlay opens under a 200ms `scale(0.98)` enter transition, and every rect inside it moves
  // with that transform: measured through it, the "before" reading is 2% small and the drift this
  // test reports would be the animation rather than the step. Wait for the transform to come off.
  await expect(page.getByTestId('topology-fullscreen-overlay')).toHaveCSS('transform', 'none');
  const overlayMiddle = () =>
    overlayViewport.evaluate(
      (el, chrome) => {
        const box = el.getBoundingClientRect();
        const ink = el.querySelector('.pr-topo__stage')!.getBoundingClientRect();
        return {
          x: ((box.left + el.clientWidth / 2 - ink.left) / ink.width) * chrome.w,
          y: ((box.top + el.clientHeight / 2 - ink.top) / ink.height) * chrome.h,
        };
      },
      { w: CHROME_W, h: CHROME_H },
    );
  /** What the box can scroll, and whether X has overflowed its own width yet. */
  const overlayBox = () =>
    overlayViewport.evaluate((el) => ({
      left: el.scrollLeft,
      top: el.scrollTop,
      sw: el.scrollWidth,
      sh: el.scrollHeight,
      cw: el.clientWidth,
      ch: el.clientHeight,
    }));

  const overlayFitted = await overlayMiddle();
  // The ladder has five stops above the fit (125 … 400), so this cannot run past the end of it — a
  // sixth click would land on a disabled 放大 and time out instead of failing on the line below.
  let crossed = false;
  for (let step = 0; step < 5 && !crossed; step++) {
    await overlay.getByTestId('topology-zoom-in').click();
    const stepped = await overlayMiddle();
    expect(Math.abs(stepped.x - overlayFitted.x)).toBeLessThanOrEqual(SLOP);
    expect(Math.abs(stepped.y - overlayFitted.y)).toBeLessThanOrEqual(SLOP);

    const box = await overlayBox();
    if (box.sw > box.cw) {
      crossed = true;
      // On a scrollable X the anchor is a real placement, not the letterboxed 0: half of the
      // drawing's own overflow. This is the case a left-aligned-stage regression would move.
      expect(box.sw - box.cw).toBeGreaterThan(SLOP);
      expect(Math.abs(box.left - (box.sw - box.cw) / 2)).toBeLessThanOrEqual(SLOP);
    }
    // Y overflows in this host from the first step, so its placement is exercised on every one.
    expect(Math.abs(box.top - (box.sh - box.ch) / 2)).toBeLessThanOrEqual(SLOP);
  }
  // The loop must have actually reached the crossing, or the assertions above say nothing about it.
  expect(crossed).toBe(true);
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
  // Back to the origin by hand: a zoom step now lands on the middle of the drawing (PR-MEMTOP-018),
  // and this test is about the drag's own 1:1 maths, whose expectations below are measured from a
  // known 0 rather than from wherever the last step happened to leave the offset.
  await viewport.evaluate((el) => {
    el.scrollLeft = 0;
    el.scrollTop = 0;
  });
  expect(await cursor()).toBe('grab');
  expect(await drag(-40, -30)).toBe('grabbing');

  const panned = await scroll();
  expect(Math.abs(panned.x - 40)).toBeLessThanOrEqual(SLOP);
  expect(Math.abs(panned.y - 30)).toBeLessThanOrEqual(SLOP);

  // Already panned, and pressed near the box's own right edge: still the drawing's gesture. A
  // scrollbar test measured from Chromium's `offsetX` (which is reported against the *content* and
  // so walks with the pan) reads this press as a thumb and drops the drag — hence the box-relative
  // one the component uses (PR-MEMTOP-017). 0.9 rather than the last pixel: on a platform whose
  // bars reserve a gutter, the band past the client box is the platform's, and this press has to
  // stay inside it.
  expect(await drag(-30, 0, { x: 0.9, y: 0.5 })).toBe('grabbing');
  const pannedAgain = await scroll();
  expect(Math.abs(pannedAgain.x - 70)).toBeLessThanOrEqual(SLOP);
  expect(Math.abs(pannedAgain.y - 30)).toBeLessThanOrEqual(SLOP);

  // The native bars are still there, and 适应窗口 still returns to the origin.
  await aside.getByTestId('topology-zoom-fit').click();
  expect(await scroll()).toEqual({ x: 0, y: 0 });
});

/**
 * The guard that keeps a scrollbar's press out of the pan: it only fires where the bars *reserve*
 * a gutter, which Chromium's overlay bars do not, so the test above never reaches it. A stable
 * gutter reserves one the way Windows / a classic-bar platform does (the geometry test uses the
 * same switch), which is where the press of a thumb would otherwise fight the drag.
 */
test('PR-MEMTOP-017: a press on a reserved scrollbar gutter does not pan', async ({ page }) => {
  await page.setViewportSize({ width: 1600, height: 900 });
  await page.goto('/?fixture=sample&renderer=canvas');
  await page.addStyleTag({ content: '.pr-topo__viewport--pannable { scrollbar-gutter: stable; }' });

  const aside = page.locator('[data-testid="stats-topology"] [data-testid="memory-topology-panel"]');
  const viewport = aside.getByTestId('topology-viewport');
  await expect(viewport).toBeVisible();
  for (let i = 0; i < 3; i++) await aside.getByTestId('topology-zoom-in').click();
  await viewport.evaluate((el) => { el.scrollLeft = 60; el.scrollTop = 40; });
  await viewport.scrollIntoViewIfNeeded();

  const box = (await viewport.boundingBox())!;
  // `offsetWidth` is `HTMLElement`-only while a `Locator` handler's element is `HTMLElement |
  // SVGElement`, so the handler is typed at the element the testid actually resolves to.
  const gutter = await viewport.evaluate((el: HTMLElement) => el.offsetWidth - el.clientWidth);
  // The switch really did reserve one — otherwise this test asserts nothing.
  expect(gutter).toBeGreaterThan(0);

  const dragFrom = async (x: number) => {
    await page.mouse.move(x, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(x - 30, box.y + box.height / 2, { steps: 5 });
    await page.mouse.up();
    return viewport.evaluate((el) => el.scrollLeft);
  };

  // In the gutter, inside the border box: the platform's thumb, not the diagram's drag. The pan
  // must not move at all, so this one is exact.
  expect(await dragFrom(box.x + box.width - 4)).toBe(60);
  // The drawing just inside it still drags — the same 1:1 pan the test above budgets for `SLOP`,
  // where Playwright's mouse coordinates and `scrollLeft` both round.
  expect(Math.abs((await dragFrom(box.x + box.width - gutter - 8)) - 90)).toBeLessThanOrEqual(SLOP);
});
