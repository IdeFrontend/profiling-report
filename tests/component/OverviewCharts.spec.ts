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

  it('PR-OV-006: draws cursor line and value tip on track hover', async () => {
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
    expect(wrap.find('[data-testid="overview-cursor"]').exists()).toBe(true);
    const track = wrap.get('[data-series-id="CUBE"]');
    await track.trigger('pointermove', { clientX: 400, clientY: 100 });
    expect(wrap.emitted('cursor')?.length).toBeGreaterThan(0);
    expect(document.querySelector('[data-testid="overview-value-tooltip"]')?.textContent).toContain(
      'CUBE',
    );
    wrap.unmount();
  });
});
