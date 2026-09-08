import { describe, expect, it } from 'vitest';
import { mount } from '@vue/test-utils';
import OverviewCharts from '../../src/ui/TimelineView/OverviewCharts/OverviewCharts.vue';
import type { OverviewSeries } from '../../src/domain/types';

describe('OverviewCharts', () => {
  it('renders one labeled track per series', () => {
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
    const wrap = mount(OverviewCharts, {
      props: { series, startTime: 0, endTime: 2000 },
    });
    expect(wrap.find('[data-testid="overview-charts"]').exists()).toBe(true);
    expect(wrap.find('[data-series-id="CUBE"]').text()).toContain('CUBE');
    expect(wrap.find('[data-series-id="SCALAR"]').text()).toContain('SCALAR');
  });
});
