import { describe, expect, it } from 'vitest';
import { flushPromises, mount } from '@vue/test-utils';
import { adaptRep, parseRep, ProfilingReport } from '../../src/index';
import { loadOutRepBuffer, loadOutRepBytes } from '../helpers/fixtures';
import type { ReportViewModel, SwimlaneModel } from '../../src/core/types';

describe('PR-UI: ProfilingReport feature contract', () => {
  it('PR-UI-001: mounts with fixture source and shows timeline chrome', async () => {
    const wrapper = mount(ProfilingReport, {
      props: { source: loadOutRepBuffer() },
    });
    await flushPromises();

    expect(wrapper.find('[data-testid="profiling-report"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="swimlane"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="swimlane-canvas"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="time-axis"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="report-toolbar"]').exists()).toBe(true);
  });

  it('PR-UI-002: select emits detail payload', async () => {
    const parsed = parseRep(loadOutRepBytes());
    const adapted = adaptRep(parsed);
    const event = adapted.swimlaneModel.processes[0]?.threads[0]?.events[0];
    expect(event).toBeDefined();

    const wrapper = mount(ProfilingReport, {
      props: {
        swimlaneModel: adapted.swimlaneModel,
        reportModel: adapted.reportModel,
      },
    });
    await flushPromises();

    await (wrapper.vm as unknown as { selectEventById: (id: string) => void }).selectEventById(
      event!.id,
    );
    await flushPromises();

    const select = wrapper.emitted('select');
    expect(select?.[0]?.[0]).toMatchObject({
      id: event!.id,
      name: event!.name,
      startTime: event!.startTime,
      duration: event!.duration,
      endTime: event!.startTime + event!.duration,
    });
  });

  it('PR-UI-003: hides optional panels when data missing (Q3 / interim)', async () => {
    const emptyReport: ReportViewModel = {
      summary: {},
      pipeOccupancy: [],
      overviewSeries: [],
    };
    const emptySwim: SwimlaneModel = {
      processes: [],
      minTime: 0,
      maxTime: 1,
    };

    const thin = mount(ProfilingReport, {
      props: { swimlaneModel: emptySwim, reportModel: emptyReport },
    });
    await flushPromises();
    expect(thin.find('[data-testid="pipe-occupancy"]').exists()).toBe(false);
    expect(thin.find('[data-testid="overview-charts"]').exists()).toBe(false);
    expect(thin.find('[data-testid="stats-compute"]').exists()).toBe(false);

    const full = mount(ProfilingReport, {
      props: {
        swimlaneModel: emptySwim,
        reportModel: {
          summary: { opName: 'add_custom', opType: 'vector', taskDurationUs: 1.8 },
          pipeOccupancy: [{ id: 'vector', label: 'Vector', ratio: 0.07, colorKey: 'vector' }],
          overviewSeries: [],
        },
      },
    });
    await flushPromises();
    expect(full.find('[data-testid="pipe-occupancy"]').exists()).toBe(true);
    expect(full.find('[data-testid="stats-summary"]').exists()).toBe(true);
    expect(full.find('[data-testid="overview-charts"]').exists()).toBe(false);
    expect(full.find('[data-testid="stats-compute"]').exists()).toBe(false);
  });

  it('PR-UI-004: zoom-to-fit resets time window', async () => {
    const adapted = adaptRep(parseRep(loadOutRepBytes()));
    const wrapper = mount(ProfilingReport, {
      props: {
        swimlaneModel: adapted.swimlaneModel,
        reportModel: adapted.reportModel,
      },
    });
    await flushPromises();

    await wrapper.get('[data-testid="zoom-in"]').trigger('click');
    await flushPromises();
    const vm = wrapper.vm as unknown as {
      viewState: { startTime: number; endTime: number };
    };
    const spanZoomed = vm.viewState.endTime - vm.viewState.startTime;
    const full = adapted.swimlaneModel.maxTime - adapted.swimlaneModel.minTime;

    expect(spanZoomed).toBeLessThan(full);

    await wrapper.get('[data-testid="zoom-to-fit"]').trigger('click');
    await flushPromises();
    expect(vm.viewState.startTime).toBe(adapted.swimlaneModel.minTime);
    expect(vm.viewState.endTime).toBe(adapted.swimlaneModel.maxTime);
  });

  it('PR-UI-005: search query updates view state', async () => {
    const adapted = adaptRep(parseRep(loadOutRepBytes()));
    const wrapper = mount(ProfilingReport, {
      props: {
        swimlaneModel: adapted.swimlaneModel,
        reportModel: adapted.reportModel,
      },
    });
    await flushPromises();

    await wrapper.get('[data-testid="search-input"]').setValue('PIPE_V');
    await flushPromises();
    const vm = wrapper.vm as unknown as { viewState: { searchQuery: string } };
    expect(vm.viewState.searchQuery).toBe('PIPE_V');
  });

  it('PR-UI-006: Chrome Trace source hides analytics aside (Q15)', async () => {
    const { loadOutTraceBuffer } = await import('../helpers/fixtures');
    const wrapper = mount(ProfilingReport, {
      props: { source: loadOutTraceBuffer(), locale: 'en' },
    });
    await flushPromises();

    expect(wrapper.find('[data-testid="swimlane"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="lane-util"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="pipe-occupancy"]').exists()).toBe(false);
    expect(wrapper.find('[data-testid="stats-summary"]').exists()).toBe(false);
    expect(wrapper.find('[data-testid="toggle-aside"]').exists()).toBe(false);
    expect(wrapper.find('[data-testid="time-unit"]').exists()).toBe(true);
  });
});
