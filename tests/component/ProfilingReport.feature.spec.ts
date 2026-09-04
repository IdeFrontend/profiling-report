import { afterEach, describe, expect, it, vi } from 'vitest';
import { flushPromises, mount } from '@vue/test-utils';
import { adaptRep, emptyReportViewModel, parseRep, ProfilingReport } from '../../src/index';
import { loadOutRepBuffer, loadOutRepBytes, loadNpuRepBuffer } from '../helpers/fixtures';
import * as swimTree from '../../src/domain/swimTree';
import * as anim from '../../src/ui/TimelineView/animateViewWindow';
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

  it('PR-UI-004: zoom-to-fit resets time window', async () => {
    stubReducedMotion();
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
        swimlaneModel: adapted.swimlaneModel,
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
      adapted.swimlaneModel.maxTime - adapted.swimlaneModel.minTime,
    );

    await wrapper.get('[data-testid="zoom-to-fit"]').trigger('click');
    await flushPromises();
    expect(vm.viewState.startTime).toBe(adapted.swimlaneModel.minTime);
    expect(vm.viewState.endTime).toBe(adapted.swimlaneModel.maxTime);
  });

  it('PR-UI-009: collapse tween keeps the display model stable (no per-frame rebuild)', async () => {
    // A default-collapsed sibling group forces `visualCollapsedIds` non-empty during the
    // tween, which is the regression path where the old code re-derived the model per frame.
    const model: SwimlaneModel = {
      minTime: 0,
      maxTime: 1000,
      metadata: { defaultCollapsedIds: ['card0/other-core'] },
      processes: [
        {
          id: 'card0',
          name: 'Card0',
          threads: [
            {
              id: 'card0/compute',
              name: 'Compute',
              categoryKey: 'compute',
              events: [],
              children: [
                {
                  id: 'card0/core-a',
                  name: 'CoreA',
                  events: [],
                  children: [
                    { id: 'card0/core-a/p0', name: 'P0', events: [{ id: 'e1', name: 'a', startTime: 0, duration: 10 }] },
                    { id: 'card0/core-a/p1', name: 'P1', events: [{ id: 'e2', name: 'b', startTime: 20, duration: 10 }] },
                  ],
                },
                {
                  id: 'card0/other-core',
                  name: 'OtherCore',
                  events: [],
                  children: [
                    { id: 'card0/other-core/p2', name: 'P2', events: [{ id: 'e3', name: 'c', startTime: 40, duration: 10 }] },
                  ],
                },
              ],
            },
          ],
        },
      ],
    };

    const filterSpy = vi.spyOn(swimTree, 'filterCollapsedTree');
    let onUpdate: ((v: number) => void) | null = null;
    let onDone: (() => void) | null = null;
    vi.spyOn(anim, 'animateProgress').mockImplementation((opts) => {
      onUpdate = opts.onUpdate ?? null;
      onDone = opts.onDone ?? null;
      return () => {};
    });

    const wrapper = mount(ProfilingReport, {
      props: { swimlaneModel: model, reportModel: emptyReportViewModel() },
    });
    await flushPromises();

    // The spy intercepts: displaySwim derived the collapsed tree on first render.
    expect(filterSpy.mock.calls.length).toBeGreaterThan(0);

    await wrapper.get('[data-testid="gutter-folder-card0/core-a"]').trigger('click');
    await flushPromises();

    expect(onUpdate).toBeTruthy();
    const callsBeforeStep = filterSpy.mock.calls.length;
    expect(callsBeforeStep).toBeGreaterThan(0);

    // Stepping the tween must not re-derive the display model (filterCollapsedTree stable).
    onUpdate!(0.6);
    await flushPromises();
    onUpdate!(0.3);
    await flushPromises();
    onUpdate!(0.1);
    await flushPromises();
    expect(filterSpy.mock.calls.length).toBe(callsBeforeStep);

    onDone!();
    await flushPromises();
    wrapper.unmount();
  });
});
