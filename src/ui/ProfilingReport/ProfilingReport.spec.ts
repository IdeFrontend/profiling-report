import { describe, expect, it } from 'vitest';
import { mount } from '@vue/test-utils';
import ProfilingReport from './ProfilingReport.vue';

describe('ProfilingReport scaffold', () => {
  it('PR-ROOT-001, PR-SCAFFOLD-003: mounts report root with timeline chrome', () => {
    const wrapper = mount(ProfilingReport, {
      props: { title: 'scaffold' },
    });
    expect(wrapper.find('[data-testid="profiling-report"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="report-tabs"]').exists()).toBe(true);
    expect(wrapper.get('[data-testid="tab-timeline"]').text()).toMatch(/时间线|Timeline/);
  });

  it('PR-ROOT-002: accepts pre-parsed model props', () => {
    const wrapper = mount(ProfilingReport, {
      props: {
        title: 'external',
        swimlaneModel: { processes: [], minTime: 0, maxTime: 1000 },
        reportModel: { summary: {}, pipeOccupancy: [], overviewSeries: [] },
      },
    });
    expect(wrapper.find('[data-testid="profiling-report"]').exists()).toBe(true);
  });
});
