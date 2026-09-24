import { test, expect, type Locator } from '@playwright/test';

/**
 * PR-MEMTOP-013's geometry, which no unit test can reach: jsdom has no layout, so the ratio of the
 * fit box to the diagram, and the distance the box can be panned, are only observable in a browser.
 *
 * The panel renders in two hosts with different pixel budgets — the stacked aside (a box that
 * already has the chrome's ratio) and the wide fullscreen overlay — and the invariant has to hold in
 * both: the *drawing* keeps 448:423, the fitted scale fills the box it was given, and the scroll
 * range covers exactly the diagram's own overflow rather than empty stage.
 */

const CHROME_W = 448;
const CHROME_H = 423;
/** `scrollWidth` reports an integer, and the diagram's own edges land on fractions. */
const SLOP = 2;

/**
 * Every test here waits a tween out, so the suite pins the motion preference it is asserting: under
 * `prefers-reduced-motion: reduce` `animateProgress` lands the step synchronously, the panel never
 * paints `data-topo-zoom-animating="true"`, and the settle hook below has nothing to wait for — a
 * machine (or CI image) with OS reduced-motion would time the suite out rather than run it. The
 * reduce path itself is covered in jsdom (`PR-MEMTOP-019b`).
 *
 * Emulated on the page rather than asked for with `test.use`: a runner-level `reducedMotion` is
 * recorded by Playwright but does not reach the page's `matchMedia` here (measured — the page still
 * reports no reduce), and `matchMedia` is the reading the panel's own `prefersReducedMotion()` makes.
 */
test.beforeEach(async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' });
});

/**
 * The diagram's on-screen rectangle, mapped from chrome units (0,0)–(448,423) through the `svg`'s own
 * CTM — the *drawing*, not the `svg` element around it, which letterboxes under
 * `preserveAspectRatio` when the element and the viewBox disagree.
 */
async function probe(panel: Locator) {
  return panel.evaluate((root, chrome) => {
    const frame = root.querySelector('.pr-topo__frame') as HTMLElement;
    const viewport = root.querySelector('[data-testid="topology-viewport"]') as HTMLElement;
    const svg = root.querySelector('.pr-topo__svg') as SVGSVGElement;
    const ctm = svg.getScreenCTM()!;
    const map = (x: number, y: number) => ({
      x: ctm.a * x + ctm.c * y + ctm.e,
      y: ctm.b * x + ctm.d * y + ctm.f,
    });
    const tl = map(0, 0);
    const br = map(chrome.w, chrome.h);
    // Frame is the stable fit box (PR-MEMTOP-013b); the scrollport's border box matches it, but
    // classic bars shrink only `clientWidth` / `clientHeight`.
    const box = frame.getBoundingClientRect();
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

/**
 * A ladder step is tweened (PR-MEMTOP-019), so a probe of the diagram's geometry is only the
 * committed one once the step has landed. The panel raises `data-topo-zoom-animating` for the
 * length of the tween — the settle hook `ReportLayout` gives the aside track — so a step here is a
 * click plus a wait, and no probe below has to know the duration.
 *
 * The wait is `false` *after* `true`: `false` is also the idle value, so waiting on it alone would
 * resolve before the step had even started and let the probe below run mid-flight. Every call site
 * steps the ladder (no call here is a no-op that would never raise the flag).
 */
async function stepZoom(panel: Locator, control: 'in' | 'out' | 'fit'): Promise<void> {
  await panel.getByTestId(`topology-zoom-${control}`).click();
  await expect(panel).toHaveAttribute('data-topo-zoom-animating', 'true');
  await expect(panel).toHaveAttribute('data-topo-zoom-animating', 'false');
}

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
  await stepZoom(aside, 'in');
  const asideZoomed = await probe(aside);
  expect(asideZoomed.inkRatio).toBeCloseTo(CHROME_W / CHROME_H, 2);
  expect(Math.abs(asideZoomed.scrollX - asideZoomed.panX)).toBeLessThanOrEqual(SLOP);
  expect(Math.abs(asideZoomed.scrollY - asideZoomed.panY)).toBeLessThanOrEqual(SLOP);
  // Fit box itself does not move when the diagram overflows (PR-MEMTOP-013b).
  expect(Math.abs(asideZoomed.box.w - asideFitted.box.w)).toBeLessThanOrEqual(SLOP);
  expect(Math.abs(asideZoomed.box.h - asideFitted.box.h)).toBeLessThanOrEqual(SLOP);
  // Stage sized from the frame: ink is zoom × fitted, not (frame − scrollbar).
  expect(asideZoomed.ink.h).toBeCloseTo(asideFitted.ink.h * 1.5, 0);
  expect(asideZoomed.ink.w).toBeCloseTo(asideFitted.ink.w * 1.5, 0);

  // The overlay is the wide host: its box is the leftover area, far wider than the diagram, so a
  // stage that followed the box would let the pan travel through empty space on both sides.
  // Probe it *before* the aside's `scrollbar-gutter` style tag below — that rule is global and
  // would change the overlay's fitted vs pannable gutters for reasons that are not this host's.
  await aside.getByTestId('topology-fullscreen').click();
  const overlay = page.locator(
    '[data-testid="topology-fullscreen-overlay"] [data-testid="memory-topology-panel"]',
  );
  await expect(overlay).toBeVisible();
  await expect(page.getByTestId('topology-fullscreen-overlay')).toHaveCSS('transform', 'none');

  const overlayFitted = await probe(overlay);
  expect(overlayFitted.box.w).toBeGreaterThan(overlayFitted.box.h * 1.5);
  expect(overlayFitted.inkRatio).toBeCloseTo(CHROME_W / CHROME_H, 2);
  expect(overlayFitted.fitsInside).toBe(true);
  expect(overlayFitted.touchesBox).toBe(true);
  expect(overlayFitted.scrollX).toBe(0);
  expect(overlayFitted.scrollY).toBe(0);

  await stepZoom(overlay, 'in');
  const overlayZoomed = await probe(overlay);
  expect(overlayZoomed.inkRatio).toBeCloseTo(CHROME_W / CHROME_H, 2);
  expect(Math.abs(overlayZoomed.scrollX - overlayZoomed.panX)).toBeLessThanOrEqual(SLOP);
  expect(Math.abs(overlayZoomed.scrollY - overlayZoomed.panY)).toBeLessThanOrEqual(SLOP);
  // PR-MEMTOP-013b: drawing scales with zoom; fit frame and reserved gutter stay put.
  expect(Math.abs(overlayZoomed.box.w - overlayFitted.box.w)).toBeLessThanOrEqual(SLOP);
  expect(Math.abs(overlayZoomed.box.h - overlayFitted.box.h)).toBeLessThanOrEqual(SLOP);
  expect(overlayZoomed.ink.h).toBeCloseTo(overlayFitted.ink.h * 1.5, 0);
  expect(overlayZoomed.ink.w).toBeCloseTo(overlayFitted.ink.w * 1.5, 0);
  expect(overlayZoomed.gutterX).toBe(overlayFitted.gutterX);

  await page.getByTestId('topology-fullscreen-back').click();
  await expect(page.getByTestId('topology-fullscreen-overlay')).toHaveCount(0);

  // Both sides of that comparison are in the *client* box, because `scrollWidth - clientWidth`
  // excludes a classic scrollbar while the border box includes it. Chromium's overlay scrollbars
  // reserve nothing, which would hide a mismatch — `scrollbar-gutter: stable` reserves the gutter
  // regardless, so the reserving regime (Windows / a stable gutter) is exercised rather than
  // assumed. Against the border box this step is off by exactly the gutter. Ink must still track
  // the frame × zoom (not shrink with the gutter) — that is PR-MEMTOP-013b.
  await page.addStyleTag({
    content: '.pr-topo__viewport--pannable { scrollbar-gutter: stable; }',
  });
  const asideReserved = await probe(aside);
  // Only the inline gutter has a CSS switch — the vertical bar — so the block-end gutter stays 0.
  expect(asideReserved.gutterX).toBeGreaterThan(0);
  expect(Math.abs(asideReserved.scrollX - asideReserved.panX)).toBeLessThanOrEqual(SLOP);
  expect(Math.abs(asideReserved.scrollY - asideReserved.panY)).toBeLessThanOrEqual(SLOP);
  expect(asideReserved.ink.h).toBeCloseTo(asideFitted.ink.h * 1.5, 0);
  expect(asideReserved.ink.w).toBeCloseTo(asideFitted.ink.w * 1.5, 0);
  expect(Math.abs(asideReserved.box.w - asideFitted.box.w)).toBeLessThanOrEqual(SLOP);
  expect(Math.abs(asideReserved.box.h - asideFitted.box.h)).toBeLessThanOrEqual(SLOP);
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

  /** The drawing's own point under the middle of the visible box, in the chrome's 448×423 units.
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

  await stepZoom(aside, 'in');
  const stepped = await middle();
  expect(Math.abs(stepped.x - fitted.x)).toBeLessThanOrEqual(SLOP);
  expect(Math.abs(stepped.y - fitted.y)).toBeLessThanOrEqual(SLOP);

  // And it holds from an offset the step did not choose — both axes, and back down a stop. A tenth
  // of the range is deliberate: the middle of a 150% drawing sits within a quarter of its own width
  // of the edges, so a deeper offset would be clamped on the way back down and move the middle for
  // a reason that is not this rule.
  await viewport.evaluate((el) => {
    el.scrollLeft = el.scrollWidth * 0.1;
    el.scrollTop = el.scrollHeight * 0.1;
  });
  const panned = await middle();

  await stepZoom(aside, 'in');
  const deeper = await middle();
  expect(Math.abs(deeper.x - panned.x)).toBeLessThanOrEqual(SLOP);
  expect(Math.abs(deeper.y - panned.y)).toBeLessThanOrEqual(SLOP);

  await stepZoom(aside, 'out');
  const back = await middle();
  expect(Math.abs(back.x - panned.x)).toBeLessThanOrEqual(SLOP);
  expect(Math.abs(back.y - panned.y)).toBeLessThanOrEqual(SLOP);

  // Same rule in the wide overlay, whose box is a different *shape* — and there, X is letterboxed at
  // first: the stage is narrower than the box until the ladder reaches ~300%, so `scrollWidth` is the
  // box's own width and the anchor is the fitted `margin-inline: auto` case. The step that crosses
  // over is the one the aside cannot reach (its box is narrow enough that 150% overflows both axes):
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
    await stepZoom(overlay, 'in');
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
  for (let i = 0; i < 3; i++) await stepZoom(aside, 'in');
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
  await stepZoom(aside, 'fit');
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
  for (let i = 0; i < 3; i++) await stepZoom(aside, 'in');
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

/**
 * PR-MEMTOP-019's tween, which the unit test can only see through a stubbed `requestAnimationFrame`:
 * here the frames are the browser's own. A step is done in two halves — the bar commits its stop on
 * the click (the readout moves at once) while the drawing travels to it over the following frames.
 * That is also the invariant every other test in this file leans on, so it is asserted rather than
 * assumed: the settle hook they wait on (`data-topo-zoom-animating`) does go up, and the drawing is
 * really between the two stops while it is up. The flight is sampled in one page-side loop, so the
 * flag and the height in each sample belong to the same frame.
 */
test('PR-MEMTOP-019: a ladder step contracts the bar at once and tweens the drawing', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1600, height: 900 });
  await page.goto('/?fixture=sample&renderer=canvas');

  const aside = page.locator('[data-testid="stats-topology"] [data-testid="memory-topology-panel"]');
  const viewport = aside.getByTestId('topology-viewport');
  await expect(viewport).toBeVisible();

  const stageHeight = () =>
    viewport.locator('.pr-topo__stage').evaluate((el) => el.getBoundingClientRect().height);
  const fitted = await stageHeight();
  expect(fitted).toBeGreaterThan(0);

  await aside.getByTestId('topology-zoom-in').click();
  // Committed on the click: the readout is the stop, not the frame's value.
  await expect(aside.getByTestId('topology-zoom-percent')).toHaveText('150%');
  // In flight: the tween is a real rAF one, and the stage has not reached the stop yet.
  await expect(aside).toHaveAttribute('data-topo-zoom-animating', 'true');

  // The flight is sampled *inside* the page, flag and height read together in the same frame: two
  // round-trips can straddle the landing, and an upper bound alone (`< stop`) passes on a stage
  // that never moved. The samples are what can be held to "between the two stops" — every one of
  // them inside the pair, and at least one of them strictly between.
  //
  // Sampled until the step lands rather than for a fixed number of frames: six ticks is a frame
  // *count*, and at 120Hz that is ~50ms of an ease-in-out cubic that has barely left the stop (the
  // 511px stage below has moved ~1px by then, failing the "strictly between" sample for a tween that
  // is running perfectly), while at 60Hz the same six ticks are ~100ms and clear it. The guard is
  // wall-clock, past the 200ms tween, so a step that never lands fails here instead of hanging.
  const samples = await aside.evaluate(async (root) => {
    const stage = root.querySelector('.pr-topo__stage') as HTMLElement;
    const out: { inFlight: boolean; h: number }[] = [];
    const guard = performance.now() + 2000;
    while (performance.now() < guard) {
      await new Promise((done) => requestAnimationFrame(() => done(null)));
      const inFlight = root.getAttribute('data-topo-zoom-animating') === 'true';
      out.push({ inFlight, h: stage.getBoundingClientRect().height });
      // Landed: this frame and everything after it is the stop itself, not the flight.
      if (!inFlight && out.length > 1) break;
    }
    return out;
  });
  const inFlight = samples.filter((sample) => sample.inFlight).map((sample) => sample.h);
  expect(inFlight.length).toBeGreaterThan(0);
  expect(inFlight.every((h) => h >= fitted - SLOP && h <= fitted * 1.5 + SLOP)).toBe(true);
  expect(inFlight.some((h) => h > fitted + SLOP && h < fitted * 1.5 - SLOP)).toBe(true);

  // Landed: the stage is the stop's own size and the flag is down, which is what every other
  // probe in this file waits for.
  await expect(aside).toHaveAttribute('data-topo-zoom-animating', 'false');
  expect(await stageHeight()).toBeCloseTo(fitted * 1.5, 0);
});
