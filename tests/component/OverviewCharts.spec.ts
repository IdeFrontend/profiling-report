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
    id: 'SCALAR',
    label: 'SCALAR',
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
    expect(wrap.find('[data-series-id="SCALAR"]').text()).toContain('SCALAR');
    expect(wrap.find('.pr-overview-stroke').exists()).toBe(true);
    expect(wrap.find('.pr-overview-fill').exists()).toBe(true);
  });

  it('PR-OV-002: SVG viewBox height is 16 (track paint height)', () => {
    const wrap = mount(OverviewCharts, {
      props: { series, startTime: 0, endTime: 2000 },
    });
    const svgs = wrap.findAll('.pr-overview-svg');
    expect(svgs).toHaveLength(2);
    for (const svg of svgs) {
      expect(svg.attributes('viewBox')).toBe('0 0 1000 16');
    }
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
    expect(wrap.emitted('pin-overview')?.[0]).toEqual(['SCALAR']);
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

  it('PR-OV-006: header and gutter hover do not emit cursor', async () => {
    const wrap = mount(OverviewCharts, {
      props: { series, startTime: 0, endTime: 2000 },
    });
    await wrap.get('.pr-overview-header').trigger('pointermove', { clientX: 10, clientY: 10 });
    await wrap.get('.pr-overview-header-track').trigger('pointermove', { clientX: 400, clientY: 10 });
    await wrap
      .get('[data-series-id="CUBE"] .pr-overview-gutter-cell')
      .trigger('pointermove', { clientX: 10, clientY: 20 });
    expect(wrap.emitted('cursor')).toBeUndefined();
  });
});
