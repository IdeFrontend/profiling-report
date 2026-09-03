import { afterEach, describe, expect, it, vi } from 'vitest';
import { flushPromises, mount } from '@vue/test-utils';
import { adaptRep, emptyReportViewModel, parseRep, ProfilingReport } from '../../src/index';
import { loadOutRepBuffer, loadOutRepBytes, loadNpuRepBuffer, loadResultNpuRepBytes } from '../helpers/fixtures';
import type { SwimlaneModel } from '../../src/domain/types';

describe('PR-UI: ProfilingReport feature contract', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  /** Zoom-to-fit / Δt focus animate the window; tests assert final bounds instantly. */
  function stubReducedMotion() {
    vi.stubGlobal('matchMedia', (query: string) => ({
      matches: query.includes('prefers-reduced-motion'),
      media: query,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false,
      onchange: null,
    }));
  }

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
    const event = adapted.swimlaneModel!.processes[0]?.threads[0]?.events[0];
    expect(event).toBeDefined();

    const wrapper = mount(ProfilingReport, {
      props: {
        swimlaneModel: adapted.swimlaneModel!,
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

  it('PR-UI-003: hides optional panels when data missing (DATA-30 / interim)', async () => {
    const emptyReport = emptyReportViewModel();
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
          ...emptyReportViewModel(),
          summary: { opName: 'add_custom', opType: 'vector', taskDurationUs: 1.8 },
          pipeOccupancy: [{ id: 'vector', label: 'Vector', ratio: 0.07, colorKey: 'vector' }],
        },
      },
    });
    await flushPromises();
    expect(full.find('[data-testid="aside-modes"]').exists()).toBe(false);
    expect(full.find('[data-testid="pipe-occupancy"]').exists()).toBe(true);
    expect(full.find('[data-testid="stats-summary"]').exists()).toBe(true);
    expect(full.find('[data-testid="overview-charts"]').exists()).toBe(false);
    expect(full.find('[data-testid="stats-compute"]').exists()).toBe(false);
  });

  it('PR-UI-009: host cycles mode falls back to time when freq is missing', async () => {
    const emptySwim: SwimlaneModel = { processes: [], minTime: 0, maxTime: 1 };
    const wrapper = mount(ProfilingReport, {
      props: {
        swimlaneModel: emptySwim,
        reportModel: emptyReportViewModel(), // summary {} → no OpBasicInfo freq
        timeDisplayMode: 'cycles',
      },
    });
    await flushPromises();

    await wrapper.get('[data-testid="toggle-display-control"]').trigger('click');
    await flushPromises();
    const select = wrapper.get('[data-testid="time-display-mode"]');
    // Fallback to wall time: the select value is `time`, and the cycles option hides.
    expect(select.attributes('value')).toBe('time');
    expect(select.findAll('option').map((o) => o.attributes('value'))).not.toContain('cycles');
  });

  it('PR-UI-010: host cycles mode holds when freq is present', async () => {
    const emptySwim: SwimlaneModel = { processes: [], minTime: 0, maxTime: 1 };
    const wrapper = mount(ProfilingReport, {
      props: {
        swimlaneModel: emptySwim,
        reportModel: { ...emptyReportViewModel(), summary: { currentFreq: 1650 } },
        timeDisplayMode: 'cycles',
      },
    });
    await flushPromises();

    await wrapper.get('[data-testid="toggle-display-control"]').trigger('click');
    await flushPromises();
    const select = wrapper.get('[data-testid="time-display-mode"]');
    expect(select.attributes('value')).toBe('cycles');
    expect(select.findAll('option').map((o) => o.attributes('value'))).toContain('cycles');
  });

  it('PR-UI-011: toolbar cycles survives freq change when host prop is omitted', async () => {
    const emptySwim: SwimlaneModel = { processes: [], minTime: 0, maxTime: 1 };
    const wrapper = mount(ProfilingReport, {
      props: {
        swimlaneModel: emptySwim,
        reportModel: { ...emptyReportViewModel(), summary: { currentFreq: 1650 } },
      },
    });
    await flushPromises();

    await wrapper.get('[data-testid="toggle-display-control"]').trigger('click');
    await flushPromises();
    await wrapper.get('[data-testid="time-display-mode"]').setValue('cycles');
    await flushPromises();
    expect(wrapper.get('[data-testid="time-display-mode"]').attributes('value')).toBe('cycles');

    // Operator switch / reload updates freq to another valid MHz — keep cycles.
    await wrapper.setProps({
      reportModel: { ...emptyReportViewModel(), summary: { currentFreq: 1800 } },
    });
    await flushPromises();
    expect(wrapper.get('[data-testid="time-display-mode"]').attributes('value')).toBe('cycles');

    // Freq disappears → fall back to wall time (UI-40a).
    await wrapper.setProps({ reportModel: emptyReportViewModel() });
    await flushPromises();
    expect(wrapper.get('[data-testid="time-display-mode"]').attributes('value')).toBe('time');
  });

  it('PR-UI-004: zoom-to-fit resets time window', async () => {
    stubReducedMotion();
    const adapted = adaptRep(parseRep(loadOutRepBytes()));
    const wrapper = mount(ProfilingReport, {
      props: {
        swimlaneModel: adapted.swimlaneModel!,
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
    const full = adapted.swimlaneModel!.maxTime - adapted.swimlaneModel!.minTime;

    expect(spanZoomed).toBeLessThan(full);

    await wrapper.get('[data-testid="zoom-to-fit"]').trigger('click');
    await flushPromises();
    expect(vm.viewState.startTime).toBe(adapted.swimlaneModel!.minTime);
    expect(vm.viewState.endTime).toBe(adapted.swimlaneModel!.maxTime);
  });

  it('PR-UI-005: search query updates view state', async () => {
    const adapted = adaptRep(parseRep(loadOutRepBytes()));
    const wrapper = mount(ProfilingReport, {
      props: {
        swimlaneModel: adapted.swimlaneModel!,
        reportModel: adapted.reportModel,
      },
    });
    await flushPromises();

    await wrapper.get('[data-testid="search-input"]').setValue('PIPE_V');
    await flushPromises();
    const vm = wrapper.vm as unknown as { viewState: { searchQuery: string } };
    expect(vm.viewState.searchQuery).toBe('PIPE_V');
  });

  it('PR-UI-006: Chrome Trace source hides analytics aside (PROC-3)', async () => {
    const { loadOutTraceBuffer } = await import('../helpers/fixtures');
    const wrapper = mount(ProfilingReport, {
      props: { source: loadOutTraceBuffer(), locale: 'en' },
    });
    await flushPromises();

    expect(wrapper.find('[data-testid="swimlane"]').exists()).toBe(true);
    // Standalone CTEF has no PipeUtilization → no invented gutter util bars
    expect(wrapper.find('[data-testid="lane-util"]').exists()).toBe(false);
    expect(wrapper.find('[data-testid="pipe-occupancy"]').exists()).toBe(false);
    expect(wrapper.find('[data-testid="stats-summary"]').exists()).toBe(false);
    expect(wrapper.find('[data-testid="toggle-aside"]').exists()).toBe(false);
    expect(wrapper.find('[data-testid="toggle-display-control"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="time-unit"]').exists()).toBe(false);
    await wrapper.get('[data-testid="toggle-display-control"]').trigger('click');
    expect(wrapper.find('[data-testid="time-unit"]').exists()).toBe(false);
    expect(wrapper.find('[data-testid="dependency-depth"]').exists()).toBe(true);
  });

  it('PR-UI-008: CSV-only report (compute/memory, no summary/pipe) auto-opens aside', async () => {
    const emptySwim: SwimlaneModel = {
      processes: [],
      minTime: 0,
      maxTime: 1,
    };
    const csvOnly = {
      ...emptyReportViewModel(),
      computeTables: [
        {
          fileName: 'PipeUtilization.csv',
          headers: ['Block', 'Util'],
          rows: [{ Block: '0', Util: '0.5' }],
          blockIds: ['0'],
        },
      ],
      memoryTables: [
        {
          fileName: 'Memory.csv',
          headers: ['Block', 'Size'],
          rows: [{ Block: '0', Size: '1' }],
          blockIds: ['0'],
        },
      ],
    };

    const wrapper = mount(ProfilingReport, {
      props: { swimlaneModel: emptySwim, reportModel: csvOnly },
    });
    await flushPromises();

    const vm = wrapper.vm as unknown as { viewState: { asideVisible: boolean } };
    expect(vm.viewState.asideVisible).toBe(true);
    expect(wrapper.find('[data-testid="toggle-aside"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="stats-aside"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="stats-summary"]').exists()).toBe(false);
    expect(wrapper.find('[data-testid="aside-modes"]').exists()).toBe(false);
    expect(wrapper.find('[data-testid="stats-compute"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="stats-memory"]').exists()).toBe(true);
  });

  it('PR-UI-012: metrics-only source renders the aside without a timeline (no hard error)', async () => {
    // data/result.npu-rep has metric CSVs + hardware info but no trace.json:
    // it must render the aside (PIPE/memory/hardware) with no swimlane and no error.
    const wrapper = mount(ProfilingReport, {
      props: { source: loadResultNpuRepBytes() },
    });
    await flushPromises();

    expect(wrapper.find('[data-testid="load-error"]').exists()).toBe(false);
    expect(wrapper.find('[data-testid="swimlane"]').exists()).toBe(false);
    expect(wrapper.find('[data-testid="stats-aside"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="pipe-occupancy"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="no-timeline"]').exists()).toBe(true);
  });

  it('PR-ROOT-004: auto-loaded source applies the adapter capabilities, the prop overrides', async () => {
    // out.rep carries roofline, hardwareDetails and memoryDiagram; loadReportSource
    // derives them, so a host passing only `source` must still get them.
    const auto = mount(ProfilingReport, { props: { source: loadOutRepBuffer() } });
    await flushPromises();
    expect(
      auto.find('[data-testid="profiling-report"]').attributes('data-capabilities'),
    ).toBe('roofline,hardwareDetails,memoryDiagram');

    const overridden = mount(ProfilingReport, {
      props: { source: loadOutRepBuffer(), capabilities: ['roofline'] },
    });
    await flushPromises();
    expect(
      overridden.find('[data-testid="profiling-report"]').attributes('data-capabilities'),
    ).toBe('roofline');

    // Same instance switched to host-managed models: the adapter's flags must not leak.
    await auto.setProps({
      source: undefined,
      swimlaneModel: { processes: [], minTime: 0, maxTime: 1 },
    } as unknown as Record<string, unknown>);
    await flushPromises();
    expect(
      auto.find('[data-testid="profiling-report"]').attributes('data-capabilities'),
    ).toBe('');

    // Multi-op auto-load then host handoff: operator state must not outlive source.
    const multi = mount(ProfilingReport, { props: { source: loadNpuRepBuffer() } });
    await flushPromises();
    expect(multi.find('[data-testid="op-selector"]').exists()).toBe(true);
    await multi.setProps({
      source: undefined,
      swimlaneModel: { processes: [], minTime: 0, maxTime: 1 },
    } as unknown as Record<string, unknown>);
    await flushPromises();
    expect(multi.find('[data-testid="op-selector"]').exists()).toBe(false);

    // Source-only clear: no stale OP selector on the empty shell.
    const cleared = mount(ProfilingReport, { props: { source: loadNpuRepBuffer() } });
    await flushPromises();
    await cleared.setProps({ source: undefined } as unknown as Record<string, unknown>);
    await flushPromises();
    expect(cleared.find('[data-testid="op-selector"]').exists()).toBe(false);
  });

  it('PR-UI-007: time overview brush adjusts visible window', async () => {
    stubReducedMotion();
    const adapted = adaptRep(parseRep(loadOutRepBytes()));
    const wrapper = mount(ProfilingReport, {
      props: {
        swimlaneModel: adapted.swimlaneModel!,
        reportModel: adapted.reportModel,
      },
    });
    await flushPromises();

    expect(wrapper.find('[data-testid="time-overview"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="time-overview-window"]').exists()).toBe(true);

    await wrapper.get('[data-testid="zoom-in"]').trigger('click');
    await flushPromises();
    const vm = wrapper.vm as unknown as {
      viewState: { startTime: number; endTime: number };
    };
    const before = { ...vm.viewState };
    expect(before.endTime - before.startTime).toBeLessThan(
      adapted.swimlaneModel!.maxTime - adapted.swimlaneModel!.minTime,
    );

    await wrapper.get('[data-testid="zoom-to-fit"]').trigger('click');
    await flushPromises();
    expect(vm.viewState.startTime).toBe(adapted.swimlaneModel!.minTime);
    expect(vm.viewState.endTime).toBe(adapted.swimlaneModel!.maxTime);
  });
});
