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
    expect(wrapper.find('[data-testid="time-axis"]').exists()).toBe(true);
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

    await wrapper.get(`[data-testid="swim-event-${event!.id}"]`).trigger('click');
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
});
