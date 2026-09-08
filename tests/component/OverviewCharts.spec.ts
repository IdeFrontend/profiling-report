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

  it('PR-OV-006: chart hover emits cursor, value tip, and value dot', async () => {
    const wrap = mount(OverviewCharts, {
      props: {
        series,
        startTime: 0,
        endTime: 2000,
        cursorXRatio: 0.5,
        cursorTime: 1000,
      },
      attachTo: document.body,
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
    await col.trigger('pointermove', { clientX: 500, clientY: 8 });
    const payload = wrap.emitted('cursor')?.at(-1)?.[0] as { xRatio: number; time: number };
    expect(payload.xRatio).toBeCloseTo(0.5);
    expect(payload.time).toBeCloseTo(1000);
    expect(wrap.find('[data-testid="overview-value-dot"]').exists()).toBe(true);
    expect(document.querySelector('[data-testid="overview-value-tooltip"]')?.textContent).toContain(
      'CUBE',
    );
    wrap.unmount();
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
    expect(wrap.find('[data-testid="overview-value-dot"]').exists()).toBe(false);

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
    await col.trigger('pointermove', { clientX: 200, button: 0, pointerId: 1 });
    const pan = wrap.emitted('pan')?.at(-1)?.[0] as number;
    expect(pan).toBeCloseTo(-0.1 * 2000);
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
});
