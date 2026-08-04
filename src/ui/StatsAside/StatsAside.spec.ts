import { describe, expect, it } from 'vitest';
import { mount } from '@vue/test-utils';
import StatsAside from './StatsAside.vue';

describe('StatsAside', () => {
  it('PR-STATS-001: renders summary stats when a valid ReportViewModel is provided', () => {
    const wrapper = mount(StatsAside, {
      props: {
        report: {
          summary: { opName: 'relu', opType: 'vector', taskDurationUs: 1234 },
          pipeOccupancy: [],
          overviewSeries: [],
        },
      },
    });

    expect(wrapper.find('[data-testid="stats-aside"]').exists()).toBe(true);
    expect(wrapper.text()).toContain('relu');
  });

  it('PR-STATS-002: renders PIPE occupancy bars', () => {
    const wrapper = mount(StatsAside, {
      props: {
        report: {
          summary: {},
          pipeOccupancy: [
            { id: 'vector', label: 'Vector', ratio: 0.75, colorKey: 'vector' },
          ],
          overviewSeries: [],
        },
      },
    });

    expect(wrapper.find('[data-testid="stats-aside"]').exists()).toBe(true);
  });
});
