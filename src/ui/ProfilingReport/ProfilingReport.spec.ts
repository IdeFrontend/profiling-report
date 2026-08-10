import { describe, expect, it } from 'vitest';
import { mount } from '@vue/test-utils';
import ProfilingReport from './ProfilingReport.vue';
import { emptyReportViewModel } from '../../adapters/adaptRep';

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
        reportModel: emptyReportViewModel(),
      },
    });
    expect(wrapper.find('[data-testid="profiling-report"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="time-axis"] [data-testid="axis-ruler"]').exists()).toBe(
      true,
    );
    expect(wrapper.find('[data-testid="gutter-resize-handle"]').exists()).toBe(true);
  });

  it('PR-STATS-006: aside close hides the stats panel', async () => {
    const wrapper = mount(ProfilingReport, {
      props: {
        title: 'aside-close',
        swimlaneModel: { processes: [], minTime: 0, maxTime: 1000 },
        reportModel: {
          summary: { opName: 'relu', opType: 'vector', taskDurationUs: 100 },
          pipeOccupancy: [],
          overviewSeries: [],
        },
      },
    });
    expect(wrapper.find('[data-testid="stats-aside"]').exists()).toBe(true);
    await wrapper.get('[data-testid="stats-aside-close"]').trigger('click');
    expect(wrapper.find('[data-testid="stats-aside"]').exists()).toBe(false);
    expect(wrapper.get('[data-testid="toggle-aside"]').attributes('aria-pressed')).toBe('false');
  });

  it('aside unavailable when only op name/type without duration or PIPE (I-Q6a)', () => {
    const wrapper = mount(ProfilingReport, {
      props: {
        title: 'no-duration',
        swimlaneModel: { processes: [], minTime: 0, maxTime: 1000 },
        reportModel: {
          summary: { opName: 'relu', opType: 'vector' },
          pipeOccupancy: [],
          overviewSeries: [],
        },
      },
    });
    expect(wrapper.find('[data-testid="toggle-aside"]').exists()).toBe(false);
    expect(wrapper.find('[data-testid="stats-aside"]').exists()).toBe(false);
  });
});
