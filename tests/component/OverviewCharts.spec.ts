import { describe, expect, it } from 'vitest';
import { mount } from '@vue/test-utils';
import OverviewCharts from '../../src/ui/TimelineView/OverviewCharts/OverviewCharts.vue';
import type { OverviewSeries } from '../../src/domain/types';

const series: OverviewSeries[] = [
  {
    id: 'CUBE',
    label: 'CUBE',
    points: [
      { t: 0, v: 0 },
      { t: 1000, v: 50 },
      { t: 2000, v: 25 },
    ],
  },
  {
    id: 'VECTOR',
    label: 'VECTOR',
    points: [
      { t: 0, v: 10 },
      { t: 2000, v: 80 },
    ],
  },
];

function mockPaintRect(
  el: HTMLElement,
  rect: { left: number; top: number; width: number; height: number },
): void {
  const full = {
    ...rect,
    right: rect.left + rect.width,
    bottom: rect.top + rect.height,
    x: rect.left,
    y: rect.top,
    toJSON() {
      return {};
    },
  } as DOMRect;
  el.getBoundingClientRect = () => full;
}

/** Mock chart-col + every track paint so multi-dot hover can position all series. */
function mockTrackPaints(
  wrap: ReturnType<typeof mount>,
  paints: Record<string, { left: number; top: number; width: number; height: number }>,
): void {
  for (const [id, rect] of Object.entries(paints)) {
    const col = wrap.find(`[data-series-id="${id}"] [data-testid="overview-chart-col"]`);
    const paint = wrap.find(`[data-series-id="${id}"] .pr-overview-paint`);
    if (col.exists()) mockPaintRect(col.element as HTMLElement, rect);
    if (paint.exists()) mockPaintRect(paint.element as HTMLElement, rect);
  }
}

function cleanupTeleport(): void {
  document.querySelectorAll('[data-testid="overview-value-dot"]').forEach((n) => n.remove());
  document.querySelectorAll('[data-testid="overview-value-tooltip"]').forEach((n) => n.remove());
}

describe('OverviewCharts', () => {
  it('PR-OV-001: renders section header and one labeled track per series', () => {
    const wrap = mount(OverviewCharts, {
      props: { series, startTime: 0, endTime: 2000, locale: 'zh-CN' },
    });
    expect(wrap.find('[data-testid="overview-charts"]').exists()).toBe(true);
    expect(wrap.text()).toContain('统计分析');
    expect(wrap.find('[data-series-id="CUBE"]').text()).toContain('CUBE');
    expect(wrap.find('[data-series-id="VECTOR"]').text()).toContain('VECTOR');
    expect(wrap.find('.pr-overview-stroke').exists()).toBe(true);
    expect(wrap.find('.pr-overview-fill').exists()).toBe(true);
    const strokes = wrap.findAll('.pr-overview-stroke');
    expect(strokes[0]!.attributes('stroke')?.toLowerCase()).toBe('#3078f0');
    expect(strokes[1]!.attributes('stroke')?.toLowerCase()).toBe('#56b19f');
  });

  it('PR-OV-002: SVG is 16px in a 24px lane with 8px top gap; 1px splitters', async () => {
    const wrap = mount(OverviewCharts, {
      props: { series, startTime: 0, endTime: 2000 },
    });
    const svgs = wrap.findAll('.pr-overview-svg');
    expect(svgs).toHaveLength(2);
    for (const svg of svgs) {
      expect(svg.attributes('viewBox')).toBe('0 0 1000 16');
    }
    const src = (await import('../../src/ui/TimelineView/OverviewCharts/OverviewCharts.vue?raw'))
      .default as string;
    expect(src).toMatch(/\.pr-overview-track\s*\{[^}]*border-bottom:\s*1px solid/);
    expect(src).toMatch(/--pr-overview-lane-h/);
    expect(src).toMatch(/--pr-overview-track-gap/);
    const layout = await import('../../src/ui/TimelineView/OverviewCharts/overviewLayout');
    expect(layout.OVERVIEW_LANE_H).toBe(24);
    expect(layout.OVERVIEW_TRACK_GAP).toBe(8);
    expect(layout.overviewSectionHeightPx(2)).toBe(40 + 48);
  });

  it('PR-OV-005: pin click emits pin-overview / unpin-overview', async () => {
    const wrap = mount(OverviewCharts, {
      props: {
        series,
        startTime: 0,
        endTime: 2000,
        pinnedOverviewIds: ['CUBE'],
      },
    });
    const pins = wrap.findAll('[data-testid="overview-pin"]');
    expect(pins).toHaveLength(2);
    await pins[1]!.trigger('click');
    expect(wrap.emitted('pin-overview')?.[0]).toEqual(['VECTOR']);
    await pins[0]!.trigger('click');
    expect(wrap.emitted('unpin-overview')?.[0]).toEqual(['CUBE']);
  });

  it('PR-OV-005: strip variant omits section header and uses sticky test id', () => {
    const wrap = mount(OverviewCharts, {
      props: {
        series: [series[0]!],
        startTime: 0,
        endTime: 2000,
        pinnedOverviewIds: ['CUBE'],
        variant: 'strip',
      },
    });
    expect(wrap.find('[data-testid="pinned-overview-charts"]').exists()).toBe(true);
    expect(wrap.text()).not.toContain('统计分析');
  });

  it('PR-OV-006: chart hover shows multi-series tip and a value-dot per track', async () => {
    const wrap = mount(OverviewCharts, {
      props: {
        series,
        startTime: 0,
        endTime: 2000,
      },
      attachTo: document.body,
    });
    mockTrackPaints(wrap, {
      CUBE: { left: 0, top: 0, width: 1000, height: 16 },
      VECTOR: { left: 0, top: 40, width: 1000, height: 16 },
    });
    const col = wrap.get('[data-series-id="CUBE"] [data-testid="overview-chart-col"]');
    await col.trigger('pointermove', { clientX: 500, clientY: 8 });
    const payload = wrap.emitted('cursor')?.at(-1)?.[0] as { xRatio: number; time: number };
    expect(payload.xRatio).toBeCloseTo(0.5);
    expect(payload.time).toBeCloseTo(1000);

    const tip = document.querySelector('[data-testid="overview-value-tooltip"]') as HTMLElement | null;
    expect(tip).toBeTruthy();
    expect(tip!.textContent).toContain('CUBE');
    expect(tip!.textContent).toContain('VECTOR');
    // CUBE at t=1000 → 50; VECTOR still holds v=10 until t=2000.
    expect(tip!.querySelector('[data-series-id="CUBE"]')?.textContent).toContain('50');
    expect(tip!.querySelector('[data-series-id="VECTOR"]')?.textContent).toContain('10');
    expect(tip!.querySelector('[data-series-id="CUBE"]')?.classList.contains('is-active')).toBe(
      true,
    );
    expect(tip!.querySelector('[data-series-id="VECTOR"]')?.classList.contains('is-active')).toBe(
      false,
    );

    const dots = [
      ...document.querySelectorAll<HTMLElement>('[data-testid="overview-value-dot"]'),
    ];
    expect(dots).toHaveLength(2);
    const cubeDot = dots.find((d) => d.getAttribute('data-series-id') === 'CUBE')!;
    const vectorDot = dots.find((d) => d.getAttribute('data-series-id') === 'VECTOR')!;
    expect(cubeDot.classList.contains('is-active')).toBe(true);
    expect(vectorDot.classList.contains('is-active')).toBe(false);
    // CUBE v=50 on 0–100 → mid of paint at top 0; VECTOR v=10 → near bottom of paint at top 40.
    expect(cubeDot.style.left).toBe('500px');
    expect(cubeDot.style.top).toBe('8px');
    expect(vectorDot.style.left).toBe('500px');
    expect(vectorDot.style.top).toBe(`${40 + (1 - 10 / 100) * 16}px`);

    wrap.unmount();
    cleanupTeleport();
  });

  it('PR-OV-006: value-dot at v=0 uses fixed paint coords (not clipped by overview)', async () => {
    cleanupTeleport();
    const zeroSeries: OverviewSeries[] = [
      {
        id: 'FIXP',
        label: 'FIXP',
        points: [
          { t: 0, v: 0 },
          { t: 2000, v: 0 },
        ],
      },
    ];
    const wrap = mount(OverviewCharts, {
      props: { series: zeroSeries, startTime: 0, endTime: 2000 },
      attachTo: document.body,
    });
    mockTrackPaints(wrap, {
      FIXP: { left: 100, top: 200, width: 400, height: 16 },
    });
    const col = wrap.get('[data-series-id="FIXP"] [data-testid="overview-chart-col"]');
    await col.trigger('pointermove', { clientX: 300, clientY: 208 });
    const dot = document.querySelector('[data-testid="overview-value-dot"]') as HTMLElement | null;
    expect(dot).toBeTruthy();
    // Center on the stroke at v=0 → bottom of the 16px paint (top + height).
    expect(dot!.style.left).toBe('300px');
    expect(dot!.style.top).toBe('216px');
    // Must not be a descendant of the overview root (would be clipped by translateY).
    expect(wrap.element.contains(dot)).toBe(false);
    wrap.unmount();
    cleanupTeleport();
  });

  it('PR-OV-006: header-track emits cursor; gutter does not', async () => {
    const wrap = mount(OverviewCharts, {
      props: { series, startTime: 0, endTime: 2000 },
    });
    const headerTrack = wrap.get('[data-testid="overview-header-track"]');
    const el = headerTrack.element as HTMLElement;
    el.getBoundingClientRect = () =>
      ({
        left: 0,
        width: 1000,
        top: 0,
        height: 28,
        right: 1000,
        bottom: 28,
        x: 0,
        y: 0,
        toJSON() {
          return {};
        },
      }) as DOMRect;
    await headerTrack.trigger('pointermove', { clientX: 250, clientY: 10 });
    const payload = wrap.emitted('cursor')?.at(-1)?.[0] as { xRatio: number };
    expect(payload.xRatio).toBeCloseTo(0.25);
    expect(document.querySelector('[data-testid="overview-value-dot"]')).toBeNull();
    expect(document.querySelector('[data-testid="overview-value-tooltip"]')).toBeNull();

    const before = wrap.emitted('cursor')!.length;
    await wrap.get('.pr-overview-header').trigger('pointermove', { clientX: 10, clientY: 10 });
    await wrap
      .get('[data-series-id="CUBE"] .pr-overview-gutter-cell')
      .trigger('pointermove', { clientX: 10, clientY: 20 });
    expect(wrap.emitted('cursor')!.length).toBe(before);
  });

  it('PR-OV-007: wheel emits wheel; chart drag emits pan', async () => {
    const wrap = mount(OverviewCharts, {
      props: { series, startTime: 0, endTime: 2000 },
    });
    await wrap.get('[data-testid="overview-charts"]').trigger('wheel', {
      deltaX: 0,
      deltaY: 40,
      ctrlKey: false,
    });
    expect(wrap.emitted('wheel')?.length).toBe(1);

    const col = wrap.get('[data-series-id="CUBE"] [data-testid="overview-chart-col"]');
    const el = col.element as HTMLElement;
    el.getBoundingClientRect = () =>
      ({
        left: 0,
        width: 1000,
        top: 0,
        height: 16,
        right: 1000,
        bottom: 16,
        x: 0,
        y: 0,
        toJSON() {
          return {};
        },
      }) as DOMRect;
    await col.trigger('pointerdown', { clientX: 100, button: 0, pointerId: 1 });
    // Cross the 4px click-vs-drag gate, then move further to pan.
    await col.trigger('pointermove', { clientX: 105, button: 0, pointerId: 1 });
    await col.trigger('pointermove', { clientX: 205, button: 0, pointerId: 1 });
    const pan = wrap.emitted('pan')?.at(-1)?.[0] as number;
    expect(pan).toBeCloseTo(-0.1 * 2000);
    wrap.unmount();
  });

  it('PR-OV-012: moves within 4px do not emit pan', async () => {
    const wrap = mount(OverviewCharts, {
      props: { series, startTime: 0, endTime: 2000 },
    });
    const col = wrap.get('[data-series-id="CUBE"] [data-testid="overview-chart-col"]');
    const el = col.element as HTMLElement;
    el.getBoundingClientRect = () =>
      ({
        left: 0,
        width: 1000,
        top: 0,
        height: 16,
        right: 1000,
        bottom: 16,
        x: 0,
        y: 0,
        toJSON() {
          return {};
        },
      }) as DOMRect;
    await col.trigger('pointerdown', { clientX: 100, button: 0, pointerId: 1 });
    await col.trigger('pointermove', { clientX: 103, button: 0, pointerId: 1 });
    expect(wrap.emitted('pan')).toBeUndefined();
    wrap.unmount();
  });

  it('PR-OV-007: measureMode suppresses chart drag pan', async () => {
    const wrap = mount(OverviewCharts, {
      props: { series, startTime: 0, endTime: 2000, measureMode: true },
    });
    const col = wrap.get('[data-series-id="CUBE"] [data-testid="overview-chart-col"]');
    await col.trigger('pointerdown', { clientX: 100, button: 0, pointerId: 1 });
    await col.trigger('pointermove', { clientX: 200, button: 0, pointerId: 1 });
    expect(wrap.emitted('pan')).toBeUndefined();
  });

  it('PR-OV-008: header click collapses tracks and emits update:collapsed', async () => {
    const wrap = mount(OverviewCharts, {
      props: { series, startTime: 0, endTime: 2000 },
    });
    expect(wrap.findAll('[data-series-id]')).toHaveLength(2);
    const header = wrap.get('[data-testid="overview-header"]');
    expect(header.attributes('aria-expanded')).toBe('true');
    await header.trigger('click');
    expect(wrap.emitted('update:collapsed')?.[0]).toEqual([true]);
    expect(wrap.findAll('[data-series-id]')).toHaveLength(0);
    expect(header.attributes('aria-expanded')).toBe('false');
    await header.trigger('click');
    expect(wrap.emitted('update:collapsed')?.[1]).toEqual([false]);
    expect(wrap.findAll('[data-series-id]')).toHaveLength(2);
  });

  it('PR-OV-008: click on header chart band collapses (full-width like Card strips)', async () => {
    const wrap = mount(OverviewCharts, {
      props: { series, startTime: 0, endTime: 2000 },
    });
    await wrap.get('[data-testid="overview-header-track"]').trigger('click');
    expect(wrap.emitted('update:collapsed')?.[0]).toEqual([true]);
    expect(wrap.findAll('[data-series-id]')).toHaveLength(0);
  });

  it('PR-OV-008: overview header gutter has no vertical splitter', async () => {
    const src = (await import('../../src/ui/TimelineView/OverviewCharts/OverviewCharts.vue?raw'))
      .default as string;
    expect(src).toMatch(
      /\.pr-overview-gutter-cell--header\s*\{[^}]*border-right:\s*none/,
    );
  });

  it('PR-OV-009: track hover uses swimlane LANE_HOVER_FILL whole-lane chrome', async () => {
    const { LANE_HOVER_FILL } = await import('../../src/swimlane/layout');
    const wrap = mount(OverviewCharts, {
      props: { series, startTime: 0, endTime: 2000 },
    });
    const root = wrap.get('[data-testid="overview-charts"]');
    expect((root.element as HTMLElement).style.getPropertyValue('--pr-overview-lane-hover')).toBe(
      LANE_HOVER_FILL,
    );
    const src = (await import('../../src/ui/TimelineView/OverviewCharts/OverviewCharts.vue?raw'))
      .default as string;
    expect(src).toMatch(
      /\.pr-overview-track:hover\s*\{[^}]*background:\s*var\(--pr-overview-lane-hover/,
    );
    expect(src).toMatch(/\.pr-overview-track:hover\s+\.pr-overview-label\s*\{[^}]*color:\s*#fff/);
  });

  it('PR-OV-010: tracks share OVERVIEW_Y_MAX 0–100 domain', async () => {
    const layout = await import('../../src/ui/TimelineView/OverviewCharts/overviewLayout');
    expect(layout.OVERVIEW_Y_MAX).toBe(100);
    const wrap = mount(OverviewCharts, {
      props: {
        series: [
          {
            id: 'CUBE',
            label: 'CUBE',
            points: [
              { t: 0, v: 50 },
              { t: 1000, v: 50 },
            ],
          },
        ],
        startTime: 0,
        endTime: 1000,
      },
      attachTo: document.body,
    });
    const col = wrap.get('[data-series-id="CUBE"] [data-testid="overview-chart-col"]');
    const paint = wrap.get('[data-series-id="CUBE"] .pr-overview-paint').element as HTMLElement;
    const rect = {
      left: 0,
      width: 1000,
      top: 0,
      height: 16,
      right: 1000,
      bottom: 16,
      x: 0,
      y: 0,
      toJSON() {
        return {};
      },
    } as DOMRect;
    (col.element as HTMLElement).getBoundingClientRect = () => rect;
    paint.getBoundingClientRect = () => rect;
    await col.trigger('pointermove', { clientX: 500, clientY: 8 });
    const dot = document.querySelector('[data-testid="overview-value-dot"]') as HTMLElement | null;
    expect(dot).toBeTruthy();
    // v=50 on 0–100 → mid band (not top — that would be per-track auto-scale).
    expect(dot!.style.top).toBe('8px');
    wrap.unmount();
    cleanupTeleport();
  });

  it('PR-OV-011: pointerup outside chart column clears tip and cursor', async () => {
    const wrap = mount(OverviewCharts, {
      props: { series, startTime: 0, endTime: 2000 },
      attachTo: document.body,
    });
    mockTrackPaints(wrap, {
      CUBE: { left: 0, top: 0, width: 1000, height: 16 },
      VECTOR: { left: 0, top: 40, width: 1000, height: 16 },
    });
    const col = wrap.get('[data-series-id="CUBE"] [data-testid="overview-chart-col"]');
    await col.trigger('pointerdown', { clientX: 100, button: 0, pointerId: 1 });
    // Cross 4px gate then move so tip/dots appear during drag.
    await col.trigger('pointermove', { clientX: 105, button: 0, pointerId: 1 });
    await col.trigger('pointermove', { clientX: 200, button: 0, pointerId: 1 });
    expect(document.querySelectorAll('[data-testid="overview-value-dot"]').length).toBe(2);
    expect(document.querySelector('[data-testid="overview-value-tooltip"]')).toBeTruthy();
    const orig = document.elementFromPoint.bind(document);
    document.elementFromPoint = () => document.body;
    await col.trigger('pointerup', { clientX: -10, clientY: -10, button: 0, pointerId: 1 });
    document.elementFromPoint = orig;
    expect(document.querySelector('[data-testid="overview-value-dot"]')).toBeNull();
    expect(document.querySelector('[data-testid="overview-value-tooltip"]')).toBeNull();
    expect(wrap.emitted('cursor')?.at(-1)?.[0]).toBeNull();
    wrap.unmount();
    cleanupTeleport();
  });
});
