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

  it('PR-ROOT-003: switching dependencyMode does not reload the page', async () => {
    const href = window.location.href;
    const wrapper = mount(ProfilingReport, {
      props: {
        title: 'deps-mode',
        swimlaneModel: { processes: [], minTime: 0, maxTime: 1000 },
        reportModel: emptyReportViewModel(),
      },
    });
    await wrapper.find('[data-testid="toggle-display-control"]').trigger('click');
    await wrapper.find('[data-testid="dependency-mode"]').setValue('predecessors');
    expect(window.location.href).toBe(href);
    expect(wrapper.find('[data-testid="profiling-report"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="time-axis"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="display-control"]').exists()).toBe(true);
    expect((wrapper.find('[data-testid="dependency-mode"]').element as HTMLSelectElement).value).toBe(
      'predecessors',
    );
  });

  it('PR-STATS-006: aside close hides the stats panel', async () => {
    const wrapper = mount(ProfilingReport, {
      props: {
        title: 'aside-close',
        swimlaneModel: { processes: [], minTime: 0, maxTime: 1000 },
        reportModel: {
          ...emptyReportViewModel(),
          summary: { opName: 'relu', opType: 'vector', taskDurationUs: 100 },
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
          ...emptyReportViewModel(),
          summary: { opName: 'relu', opType: 'vector' },
        },
      },
    });
    expect(wrapper.find('[data-testid="toggle-aside"]').exists()).toBe(false);
    expect(wrapper.find('[data-testid="stats-aside"]').exists()).toBe(false);
  });

  it('toolbar lives in main column only (not full-width above aside)', () => {
    const wrapper = mount(ProfilingReport, {
      props: {
        title: 'toolbar-column',
        swimlaneModel: { processes: [], minTime: 0, maxTime: 1000 },
        reportModel: {
          ...emptyReportViewModel(),
          summary: { opName: 'relu', opType: 'vector', taskDurationUs: 100 },
        },
      },
    });
    const main = wrapper.find('.pr-main');
    expect(main.exists()).toBe(true);
    expect(main.find('[data-testid="report-toolbar"]').exists()).toBe(true);
    expect(main.find('[data-testid="time-axis"]').exists()).toBe(true);
    // Toolbar must not be a direct child of root sitting above the layout.
    const rootChildren = wrapper.find('[data-testid="profiling-report"]').element.children;
    const directToolbar = [...rootChildren].some(
      (el) => (el as HTMLElement).dataset?.testid === 'report-toolbar',
    );
    expect(directToolbar).toBe(false);
    expect(wrapper.find('.pr-layout__aside [data-testid="stats-aside"]').exists()).toBe(true);
  });
});
