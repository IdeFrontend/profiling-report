import { describe, expect, it } from 'vitest';
import { markRaw, nextTick } from 'vue';
import { mount } from '@vue/test-utils';
import ProfilingReport from './ProfilingReport.vue';
import TimelineView from '../TimelineView/TimelineView.vue';
import { emptyReportViewModel } from '../../adapters/adaptRep';
import { CANNBOT_PROMPT } from '../../domain/cannbot';
import type { CannbotPayload } from '../../domain/cannbot';
import type { SwimlaneModel } from '../../domain/types';

/** Two linked events, so the dock mounts its Relevent column. */
function depsModel(): SwimlaneModel {
  return {
    processes: [
      {
        id: 'p-0',
        name: 'Card0',
        threads: [
          {
            id: 't-0',
            name: 'Core0.Cube',
            events: [
              {
                id: 'a',
                name: 'A',
                startTime: 0,
                duration: 10,
                dependencies: { predecessors: [], successors: [{ tid: 't-0', index: 1 }] },
              },
              {
                id: 'b',
                name: 'B',
                startTime: 20,
                duration: 10,
                dependencies: { predecessors: [{ tid: 't-0', index: 0 }], successors: [] },
              },
            ],
          },
        ],
      },
    ],
    minTime: 0,
    maxTime: 1000,
  };
}

function topologyReport() {
  return {
    ...emptyReportViewModel(),
    summary: { taskDurationUs: 1 },
    memoryTables: [
      {
        fileName: 'Memory.csv',
        headers: ['block_id', 'aic_l1_read_bw(GB/s)'],
        rows: [{ block_id: '0', 'aic_l1_read_bw(GB/s)': '1.2' }],
        blockIds: ['0'],
      },
    ],
    csvTexts: { 'Memory.csv': 'block_id,aic_l1_read_bw(GB/s)\n0,1.2\n' },
  };
}

describe('ProfilingReport scaffold', () => {
  it('PR-ROOT-001, PR-SCAFFOLD-003: mounts report root with timeline chrome', () => {
    const wrapper = mount(ProfilingReport, {
      props: { title: 'scaffold' },
    });
    expect(wrapper.find('[data-testid="profiling-report"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="report-tabs"]').exists()).toBe(true);
    expect(wrapper.get('[data-testid="tab-timeline"]').text()).toMatch(/时间线|Timeline/);
  });

  it('PR-ROOT-006: corner wash is no longer a root layer (moved to the toolbar strip)', async () => {
    const src = (await import('./ProfilingReport.vue?raw')).default as string;
    // At the root it sat under `.pr-main` (z-index: 1, opaque) and never painted.
    expect(src).not.toMatch(/pr-root__corner-wash/);
  });

  it('PR-ROOT-014: the dock stacks above the timeline so the cursor playhead cannot paint over it', async () => {
    const src = (await import('./ProfilingReport.vue?raw')).default as string;
    // `.pr-main` (ReportLayout) is `z-index: 1`; the dock must sit above it or the
    // full-height cursor stem (CursorTimestamp, `height: 100vh`) paints over the dock.
    expect(src).toMatch(/\.pr-dock\s*\{[^}]*z-index:\s*[2-9]/);
  });

  it('PR-ROOT-015: dock enter height-tweens; leave stays absolute + translateY', async () => {
    const src = (await import('./ProfilingReport.vue?raw')).default as string;
    // Enter must not reserve a full-height slot while painted off-screen (black hole).
    expect(src).toMatch(/\.pr-dock-enter-active\s*\{[^}]*height\s+200ms/s);
    expect(src).toMatch(/\.pr-dock-enter-from\s*\{[^}]*height:\s*0/s);
    expect(src).not.toMatch(/\.pr-dock-enter-from\s*\{[^}]*translateY/s);
    // Shared enter-from+leave-to translateY was the black-hole bug — must stay split.
    expect(src).not.toMatch(
      /\.pr-dock-enter-from\s*,\s*\.pr-dock-leave-to\s*\{[^}]*translateY/s,
    );
    // Leave keeps the intentional absolute slide so the swimlane grows mid-leave.
    expect(src).toMatch(/\.pr-dock-leave-active\s*\{[^}]*position:\s*absolute/s);
    expect(src).toMatch(/\.pr-dock-leave-active\s*\{[^}]*transform\s+200ms/s);
    expect(src).toMatch(/\.pr-dock-leave-to\s*\{[^}]*translateY\(100%\)/s);
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

  it('PR-ROOT-003: switching dependency mode in the detail dock does not reload the page', async () => {
    const href = window.location.href;
    const wrapper = mount(ProfilingReport, {
      props: {
        title: 'deps-mode',
        swimlaneModel: depsModel(),
        reportModel: emptyReportViewModel(),
      },
    });
    (wrapper.vm as unknown as { selectEventById: (id: string) => void }).selectEventById('b');
    await nextTick();

    await wrapper
      .find('[data-testid="detail-relevant-direction-predecessors"]')
      .trigger('click');
    await nextTick();

    expect(window.location.href).toBe(href);
    expect(wrapper.find('[data-testid="profiling-report"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="time-axis"]').exists()).toBe(true);
    // Mode reached the walk: 'b' keeps its predecessor, the successor side is blank.
    expect(
      wrapper
        .find('[data-testid="detail-relevant-direction-predecessors"]')
        .attributes('aria-pressed'),
    ).toBe('true');
    expect(wrapper.find('[data-testid="detail-relevant-incoming-count"]').text()).toBe('1');
    expect(wrapper.find('[data-testid="detail-relevant-outgoing-count"]').text()).toBe('0');
  });

  it('PR-ROOT-007: marquee mounts the multi-select dock; single-select and Escape swap it back', async () => {
    const wrapper = mount(ProfilingReport, {
      props: {
        title: 'multi-select',
        swimlaneModel: depsModel(),
        reportModel: emptyReportViewModel(),
      },
    });
    const vm = wrapper.vm as unknown as {
      selectEventById: (id: string) => void;
      viewState: { selectedEventId: string | null; multiSelectedIds: string[] };
    };

    // Single-select first, so the swap out of DetailPanel is exercised.
    vm.selectEventById('a');
    await nextTick();
    expect(wrapper.find('[data-testid="detail-panel"]').exists()).toBe(true);

    const model = depsModel();
    const events = model.processes[0]!.threads[0]!.events;
    const timeline = () => wrapper.findComponent({ name: 'TimelineView' });
    timeline().vm.$emit('multi-select', events);
    await nextTick();

    // Multi-select wins: the two docks are mutually exclusive.
    expect(wrapper.find('[data-testid="multi-select-summary"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="detail-panel"]').exists()).toBe(false);
    expect(wrapper.get('[data-testid="multi-select-tab"]').text()).toBe('Slices (2)');
    expect(vm.viewState.multiSelectedIds).toEqual(['a', 'b']);
    expect(vm.viewState.selectedEventId).toBeNull();
    // Axis Δt is cleared on commit (it only followed the live drag).
    expect(timeline().props('multiSelectSpan')).toBeNull();
    // The documented overload: a non-empty commit dismisses the single selection, so the
    // host hears select(null) even though the multi-select dock is up.
    expect(wrapper.emitted('select')?.at(-1)).toEqual([null]);

    // Name click transitions to single-select + DetailPanel.
    await wrapper.get('[data-testid="multi-select-name-b"]').trigger('click');
    await nextTick();
    expect(wrapper.find('[data-testid="multi-select-summary"]').exists()).toBe(false);
    expect(wrapper.find('[data-testid="detail-panel"]').exists()).toBe(true);
    expect(vm.viewState.multiSelectedIds).toEqual([]);
    expect(vm.viewState.selectedEventId).toBe('b');
    expect(timeline().props('multiSelectSpan')).toBeNull();

    // Escape clears the marquee selection (and mounts neither dock).
    timeline().vm.$emit('multi-select', events);
    await nextTick();
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    await nextTick();
    expect(wrapper.find('[data-testid="multi-select-summary"]').exists()).toBe(false);
    expect(wrapper.find('[data-testid="detail-panel"]').exists()).toBe(false);
    expect(vm.viewState.multiSelectedIds).toEqual([]);
    expect(timeline().props('multiSelectSpan')).toBeNull();

    // Escape clears multi-select even when Shift is held; WASD guards do not apply to Escape.
    timeline().vm.$emit('multi-select', events);
    await nextTick();
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', shiftKey: true }));
    await nextTick();
    expect(wrapper.find('[data-testid="multi-select-summary"]').exists()).toBe(false);
    expect(vm.viewState.multiSelectedIds).toEqual([]);

    wrapper.unmount();
  });

  it('PR-ROOT-007: a one-event marquee commit demotes to DetailPanel', async () => {
    const wrapper = mount(ProfilingReport, {
      props: {
        title: 'multi-select-one',
        swimlaneModel: depsModel(),
        reportModel: emptyReportViewModel(),
      },
    });
    const vm = wrapper.vm as unknown as {
      viewState: { selectedEventId: string | null; multiSelectedIds: string[] };
    };
    const model = depsModel();
    const only = [model.processes[0]!.threads[0]!.events[0]!];
    const timeline = () => wrapper.findComponent({ name: 'TimelineView' });

    timeline().vm.$emit('multi-select', only);
    await nextTick();

    expect(wrapper.find('[data-testid="multi-select-summary"]').exists()).toBe(false);
    expect(wrapper.find('[data-testid="detail-panel"]').exists()).toBe(true);
    expect(vm.viewState.multiSelectedIds).toEqual([]);
    expect(vm.viewState.selectedEventId).toBe('a');
    expect(wrapper.emitted('select')?.at(-1)?.[0]).toMatchObject({ id: 'a' });
    expect(timeline().props('multiSelectSpan')).toBeNull();

    wrapper.unmount();
  });

  it('PR-ROOT-007: the live marquee span reaches the axis before the commit', async () => {
    const wrapper = mount(ProfilingReport, {
      props: {
        title: 'multi-select-span',
        swimlaneModel: depsModel(),
        reportModel: emptyReportViewModel(),
      },
    });
    const timeline = () => wrapper.findComponent({ name: 'TimelineView' });

    timeline().vm.$emit('multi-select-span', { startTime: 5, endTime: 25 });
    await nextTick();
    expect(timeline().props('multiSelectSpan')).toEqual({ startTime: 5, endTime: 25 });
    // No dock yet — the rect has not committed.
    expect(wrapper.find('[data-testid="multi-select-summary"]').exists()).toBe(false);

    // The canvas nulls the drag span on pointerup; the root does not replace it with a hull.
    timeline().vm.$emit('multi-select-span', null);
    timeline().vm.$emit('multi-select', depsModel().processes[0]!.threads[0]!.events);
    await nextTick();
    expect(timeline().props('multiSelectSpan')).toBeNull();
    wrapper.unmount();
  });

  it('PR-ROOT-007: an empty marquee commit clears the selection and emits select(null)', async () => {
    const wrapper = mount(ProfilingReport, {
      props: {
        title: 'multi-select-empty',
        swimlaneModel: depsModel(),
        reportModel: emptyReportViewModel(),
      },
    });
    const vm = wrapper.vm as unknown as {
      selectEventById: (id: string) => void;
      viewState: { selectedEventId: string | null; multiSelectedIds: string[] };
    };
    vm.selectEventById('a');
    await nextTick();

    wrapper.findComponent({ name: 'TimelineView' }).vm.$emit('multi-select', []);
    await nextTick();

    expect(wrapper.find('[data-testid="multi-select-summary"]').exists()).toBe(false);
    expect(wrapper.find('[data-testid="detail-panel"]').exists()).toBe(false);
    expect(vm.viewState.selectedEventId).toBeNull();
    expect(vm.viewState.multiSelectedIds).toEqual([]);
    expect(wrapper.emitted('select')?.at(-1)).toEqual([null]);
    wrapper.unmount();
  });

  it('PR-ROOT-016: live preview mounts Detail for 1 / Summary for ≥2 without host select', async () => {
    const wrapper = mount(ProfilingReport, {
      props: {
        title: 'live-preview',
        swimlaneModel: depsModel(),
        reportModel: emptyReportViewModel(),
      },
    });
    const vm = wrapper.vm as unknown as {
      selectEventById: (id: string) => void;
      viewState: { selectedEventId: string | null; multiSelectedIds: string[] };
    };
    const model = depsModel();
    const events = model.processes[0]!.threads[0]!.events;
    const timeline = () => wrapper.findComponent({ name: 'TimelineView' });

    vm.selectEventById('a');
    await nextTick();
    const selectBefore = wrapper.emitted('select')?.length ?? 0;

    timeline().vm.$emit('multi-select-preview', [events[1]!]);
    await nextTick();
    expect(wrapper.find('[data-testid="detail-panel"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="multi-select-summary"]').exists()).toBe(false);
    expect(wrapper.find('[data-testid="dock"]').exists()).toBe(true);
    expect(vm.viewState.selectedEventId).toBe('a');
    expect(vm.viewState.multiSelectedIds).toEqual([]);
    expect(wrapper.emitted('select')?.length ?? 0).toBe(selectBefore);

    timeline().vm.$emit('multi-select-preview', events);
    await nextTick();
    expect(wrapper.find('[data-testid="multi-select-summary"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="detail-panel"]').exists()).toBe(false);
    expect(wrapper.find('[data-testid="dock"]').exists()).toBe(true);
    expect(vm.viewState.selectedEventId).toBe('a');
    expect(vm.viewState.multiSelectedIds).toEqual([]);
    expect(wrapper.emitted('select')?.length ?? 0).toBe(selectBefore);

    // Empty mid-drag keeps the last non-empty preview (no leave flicker).
    timeline().vm.$emit('multi-select-preview', []);
    await nextTick();
    expect(wrapper.find('[data-testid="multi-select-summary"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="dock"]').exists()).toBe(true);

    timeline().vm.$emit('multi-select', events);
    await nextTick();
    expect(wrapper.find('[data-testid="multi-select-summary"]').exists()).toBe(true);
    expect(vm.viewState.multiSelectedIds).toEqual(['a', 'b']);
    expect(wrapper.emitted('select')?.at(-1)).toEqual([null]);

    wrapper.unmount();
  });

  it('PR-ROOT-016: Escape mid-drag restores the pre-drag dock without host select', async () => {
    const wrapper = mount(ProfilingReport, {
      props: {
        title: 'live-preview-escape',
        swimlaneModel: depsModel(),
        reportModel: emptyReportViewModel(),
      },
    });
    const vm = wrapper.vm as unknown as {
      selectEventById: (id: string) => void;
      viewState: { selectedEventId: string | null; multiSelectedIds: string[] };
    };
    const model = depsModel();
    const events = model.processes[0]!.threads[0]!.events;
    const timeline = () => wrapper.findComponent({ name: 'TimelineView' });

    vm.selectEventById('a');
    await nextTick();
    const selectBefore = wrapper.emitted('select')?.length ?? 0;

    timeline().vm.$emit('multi-select-preview', events);
    await nextTick();
    expect(wrapper.find('[data-testid="multi-select-summary"]').exists()).toBe(true);

    // Real Escape hits root first (would clear committed multi). While marqueeLive,
    // root must not onSelect(null); canvas then emits preview(null) to restore UI.
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    await nextTick();
    expect(wrapper.emitted('select')?.length ?? 0).toBe(selectBefore);
    expect(vm.viewState.selectedEventId).toBe('a');
    expect(vm.viewState.multiSelectedIds).toEqual([]);

    timeline().vm.$emit('multi-select-preview', null);
    await nextTick();
    expect(wrapper.find('[data-testid="multi-select-summary"]').exists()).toBe(false);
    expect(wrapper.find('[data-testid="detail-panel"]').exists()).toBe(true);
    expect(vm.viewState.selectedEventId).toBe('a');
    expect(wrapper.emitted('select')?.length ?? 0).toBe(selectBefore);

    wrapper.unmount();
  });

  it('PR-ROOT-016: empty-first preview does not mount a blank dock', async () => {
    const wrapper = mount(ProfilingReport, {
      props: {
        title: 'live-preview-empty-first',
        swimlaneModel: depsModel(),
        reportModel: emptyReportViewModel(),
      },
    });
    const timeline = () => wrapper.findComponent({ name: 'TimelineView' });

    timeline().vm.$emit('multi-select-preview', []);
    await nextTick();
    expect(wrapper.find('[data-testid="dock"]').exists()).toBe(false);
    expect(wrapper.find('[data-testid="multi-select-summary"]').exists()).toBe(false);
    expect(wrapper.find('[data-testid="detail-panel"]').exists()).toBe(false);

    wrapper.unmount();
  });

  it('PR-ROOT-017: mode swap keeps the dock shell mounted and defines content fade CSS', async () => {
    const wrapper = mount(ProfilingReport, {
      props: {
        title: 'dock-content-fade',
        swimlaneModel: depsModel(),
        reportModel: emptyReportViewModel(),
      },
    });
    const model = depsModel();
    const events = model.processes[0]!.threads[0]!.events;
    const timeline = () => wrapper.findComponent({ name: 'TimelineView' });

    timeline().vm.$emit('multi-select-preview', [events[0]!]);
    await nextTick();
    const dock = wrapper.get('[data-testid="dock"]');
    expect(wrapper.find('[data-testid="detail-panel"]').exists()).toBe(true);

    timeline().vm.$emit('multi-select-preview', events);
    await nextTick();
    expect(wrapper.find('[data-testid="multi-select-summary"]').exists()).toBe(true);
    expect(wrapper.get('[data-testid="dock"]').element).toBe(dock.element);

    const src = (await import('./ProfilingReport.vue?raw')).default as string;
    expect(src).toMatch(/\.pr-dock-content-enter-active[\s\S]*?opacity\s+180ms/);
    expect(src).toMatch(/name="pr-dock-content"/);
    expect(src).toMatch(/mode="out-in"/);

    wrapper.unmount();
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

  it('aside unavailable when only op name/type without duration or PIPE (DATA-33a)', () => {
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

  it('PR-ROOT-005: multi-op npu-rep source renders OP selector and switches operator', async () => {
    const { loadNpuRepBuffer } = await import('../../../tests/helpers/fixtures');
    const wrapper = mount(ProfilingReport, {
      props: { source: loadNpuRepBuffer() },
    });

    expect(wrapper.find('[data-testid="op-selector"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="op-selector-label"]').text()).toBe('op1');
    expect(wrapper.vm.selectedOperatorId).toBe('op1.npu.rep');

    await wrapper.find('[data-testid="op-selector"] button').trigger('click');
    const items = wrapper.findAll('[data-testid="op-item"]');
    expect(items).toHaveLength(2);
    expect(items.map((i) => i.text())).toEqual(['op1', 'op2']);
    expect(items[0].attributes('aria-selected')).toBe('true');
    await items[1].trigger('click');

    expect(wrapper.vm.selectedOperatorId).toBe('op2.npu.rep');
    expect(wrapper.find('[data-testid="op-selector-label"]').text()).toBe('op2');
    expect(wrapper.find('[data-testid="profiling-report"]').exists()).toBe(true);

    await wrapper.find('[data-testid="op-selector"] button').trigger('click');
    const after = wrapper.findAll('[data-testid="op-item"]');
    expect(after[1].attributes('aria-selected')).toBe('true');
  });

  it('PR-ROOT-005b: switching operator swaps models; re-select is a no-op', async () => {
    const { vi } = await import('vitest');
    const adapters = await import('../../adapters');
    const swimA = {
      processes: [
        {
          id: 'p',
          name: 'P',
          threads: [
            {
              id: 't',
              name: 'T',
              events: [{ id: 'ea', name: 'event-a', startTime: 0, duration: 10 }],
            },
          ],
        },
      ],
      minTime: 0,
      maxTime: 10,
    };
    const swimB = {
      processes: [
        {
          id: 'p',
          name: 'P',
          threads: [
            {
              id: 't',
              name: 'T',
              events: [{ id: 'eb', name: 'event-b', startTime: 0, duration: 99 }],
            },
          ],
        },
      ],
      minTime: 0,
      maxTime: 99,
    };
    const reportA = {
      ...emptyReportViewModel(),
      summary: { opName: 'alpha-op', taskDurationUs: 100 },
    };
    const reportB = {
      ...emptyReportViewModel(),
      summary: { opName: 'beta-op', taskDurationUs: 200 },
    };
    const spy = vi.spyOn(adapters, 'loadReportSource').mockReturnValue({
      swimlaneModel: swimA,
      reportModel: reportA,
      capabilities: ['roofline'],
      operators: [
        { id: 'a.npu.rep', label: 'a' },
        { id: 'b.npu.rep', label: 'b' },
      ],
      operatorReports: {
        'a.npu.rep': { swimlaneModel: swimA, reportModel: reportA, capabilities: ['roofline'] },
        'b.npu.rep': { swimlaneModel: swimB, reportModel: reportB, capabilities: ['dependencies'] },
      },
      selectedOperatorId: 'a.npu.rep',
    });

    try {
      const wrapper = mount(ProfilingReport, {
        props: { source: new ArrayBuffer(8) },
      });
      expect(wrapper.text()).toContain('alpha-op');
      expect(wrapper.find('[data-testid="profiling-report"]').attributes('data-capabilities')).toBe(
        'roofline',
      );

      await wrapper.find('[data-testid="op-selector"] button').trigger('click');
      await wrapper.findAll('[data-testid="op-item"]')[1].trigger('click');
      expect(wrapper.vm.selectedOperatorId).toBe('b.npu.rep');
      expect(wrapper.text()).toContain('beta-op');
      expect(wrapper.find('[data-testid="profiling-report"]').attributes('data-capabilities')).toBe(
        'dependencies',
      );
      expect(wrapper.text()).not.toContain('alpha-op');

      const endBefore = wrapper.vm.viewState.endTime;
      wrapper.vm.viewState.searchQuery = 'keep-me';
      await wrapper.find('[data-testid="op-selector"] button').trigger('click');
      await wrapper.findAll('[data-testid="op-item"]')[1].trigger('click');
      expect(wrapper.vm.viewState.searchQuery).toBe('keep-me');
      expect(wrapper.vm.viewState.endTime).toBe(endBefore);
    } finally {
      spy.mockRestore();
    }
  });

  it('PR-ROOT-005c: closing aside then switching operator keeps aside closed', async () => {
    const { vi } = await import('vitest');
    const adapters = await import('../../adapters');
    const swim = {
      processes: [
        {
          id: 'p',
          name: 'P',
          threads: [
            {
              id: 't',
              name: 'T',
              events: [{ id: 'e', name: 'ev', startTime: 0, duration: 10 }],
            },
          ],
        },
      ],
      minTime: 0,
      maxTime: 10,
    };
    const reportA = {
      ...emptyReportViewModel(),
      summary: { opName: 'alpha-op', taskDurationUs: 100 },
    };
    const reportB = {
      ...emptyReportViewModel(),
      summary: { opName: 'beta-op', taskDurationUs: 200 },
    };
    const spy = vi.spyOn(adapters, 'loadReportSource').mockReturnValue({
      swimlaneModel: swim,
      reportModel: reportA,
      capabilities: [],
      operators: [
        { id: 'a.npu.rep', label: 'a' },
        { id: 'b.npu.rep', label: 'b' },
      ],
      operatorReports: {
        'a.npu.rep': { swimlaneModel: swim, reportModel: reportA, capabilities: [] },
        'b.npu.rep': { swimlaneModel: swim, reportModel: reportB, capabilities: [] },
      },
      selectedOperatorId: 'a.npu.rep',
    });

    try {
      const wrapper = mount(ProfilingReport, {
        props: { source: new ArrayBuffer(8) },
      });
      expect(wrapper.find('[data-testid="stats-aside"]').exists()).toBe(true);

      await wrapper.get('[data-testid="stats-aside-close"]').trigger('click');
      expect(wrapper.find('[data-testid="stats-aside"]').exists()).toBe(false);
      expect(wrapper.vm.viewState.asideVisible).toBe(false);

      await wrapper.find('[data-testid="op-selector"] button').trigger('click');
      await wrapper.findAll('[data-testid="op-item"]')[1].trigger('click');
      expect(wrapper.vm.selectedOperatorId).toBe('b.npu.rep');
      expect(wrapper.vm.viewState.asideVisible).toBe(false);
      expect(wrapper.find('[data-testid="stats-aside"]').exists()).toBe(false);
    } finally {
      spy.mockRestore();
    }
  });

  it('PR-ROOT-005d: switching operator keeps a manually resized aside width', async () => {
    const { vi } = await import('vitest');
    const adapters = await import('../../adapters');
    const swim = {
      processes: [
        {
          id: 'p',
          name: 'P',
          threads: [
            {
              id: 't',
              name: 'T',
              events: [{ id: 'e', name: 'ev', startTime: 0, duration: 10 }],
            },
          ],
        },
      ],
      minTime: 0,
      maxTime: 10,
    };
    const reportA = {
      ...emptyReportViewModel(),
      summary: { opName: 'alpha-op', taskDurationUs: 100 },
    };
    const reportB = {
      ...emptyReportViewModel(),
      summary: { opName: 'beta-op', taskDurationUs: 200 },
    };
    const spy = vi.spyOn(adapters, 'loadReportSource').mockReturnValue({
      swimlaneModel: swim,
      reportModel: reportA,
      capabilities: [],
      operators: [
        { id: 'a.npu.rep', label: 'a' },
        { id: 'b.npu.rep', label: 'b' },
      ],
      operatorReports: {
        'a.npu.rep': { swimlaneModel: swim, reportModel: reportA, capabilities: [] },
        'b.npu.rep': { swimlaneModel: swim, reportModel: reportB, capabilities: [] },
      },
      selectedOperatorId: 'a.npu.rep',
    });

    try {
      const wrapper = mount(ProfilingReport, {
        props: { source: new ArrayBuffer(8) },
      });
      const layout = wrapper.find('.pr-layout');
      expect(layout.attributes('style')).toContain('--pr-aside-width: 480px');

      const handle = wrapper.find('[data-testid="aside-resize-handle"]');
      await handle.trigger('pointerdown', { button: 0, clientX: 1400, pointerId: 1 });
      await handle.trigger('pointermove', { clientX: 1280, pointerId: 1 });
      await handle.trigger('pointerup');
      expect(layout.attributes('style')).toContain('--pr-aside-width: 600px');

      await wrapper.find('[data-testid="op-selector"] button').trigger('click');
      await wrapper.findAll('[data-testid="op-item"]')[1].trigger('click');
      expect(wrapper.vm.selectedOperatorId).toBe('b.npu.rep');
      expect(wrapper.find('.pr-layout').attributes('style')).toContain('--pr-aside-width: 600px');
    } finally {
      spy.mockRestore();
    }
  });

  it('PR-ROOT-008: cannbot buttons emit cannbot-request with scoped payload', async () => {
    const reportModel = {
      summary: { opName: 'matmul_v3', opType: 'mix', pid: '3073000', blockDim: 8, taskDurationUs: 4600 },
      pipeOccupancy: [{ id: 'vector', label: 'Vector', ratio: 0.5, colorKey: 'vector', side: 'vector' as const }],
      overviewSeries: [],
      computeTables: [{ fileName: 'PipeUtilization.csv', headers: ['block_id', 'aiv_vec_ratio'], rows: [{ block_id: '0', aiv_vec_ratio: '0.5' }], blockIds: ['0'] }],
      memoryTables: [{ fileName: 'Memory.csv', headers: ['block_id'], rows: [{ block_id: '0' }], blockIds: ['0'] }],
      csvTexts: { 'PipeUtilization.csv': 'block_id,aiv_vec_ratio\n0,0.5\n', 'Memory.csv': 'block_id\n0\n' },
    };
    const wrapper = mount(ProfilingReport, {
      props: {
        title: 'cannbot',
        swimlaneModel: { processes: [], minTime: 0, maxTime: 1000 },
        // markRaw: VTU stores mount props in a deep reactive() — keep the fixture
        // unproxied so the payload's by-reference data matches the host's object.
        reportModel: markRaw(reportModel),
        reportMeta: { name: 'matmul_v3.r3', path: 'C:/reports/matmul_v3.r3', id: 'report-42', collectedAt: '2026-08-13T09:41:00Z' },
      },
    });
    expect(wrapper.find('[data-testid="stats-aside"]').exists()).toBe(true);

    await wrapper.get('[data-testid="cannbot-compute"]').trigger('click');
    const evt = wrapper.emitted('cannbot-request');
    expect(evt).toHaveLength(1);
    const payload = evt![0]![0] as CannbotPayload;
    expect(payload.version).toBe('1.0');
    expect(payload.scope).toBe('compute');
    expect(payload.report_name).toBe('matmul_v3.r3');
    expect(payload.report_id).toBe('report-42');
    expect(payload.report_path).toBe('C:/reports/matmul_v3.r3');
    expect(payload.collected_at).toBe('2026-08-13T09:41:00Z');
    expect(payload.op_name).toBe('matmul_v3');
    expect(payload.prompt).toBe(CANNBOT_PROMPT);
    expect(payload.data.pipeOccupancy).toBe(reportModel.pipeOccupancy);
    expect(payload.data.computeTables).toBe(reportModel.computeTables);
    expect(Object.keys(payload.data.csvTexts as Record<string, string>)).toEqual([
      'PipeUtilization.csv',
    ]);

    await wrapper.get('[data-testid="cannbot-summary"]').trigger('click');
    const all = wrapper.emitted('cannbot-request')!;
    expect(all).toHaveLength(2);
    const summaryPayload = all[1]![0] as CannbotPayload;
    expect(summaryPayload.scope).toBe('summary');
    expect((summaryPayload.data.summary as { opName?: string }).opName).toBe('matmul_v3');
  });

  it('PR-ROOT-009: topology 全屏 covers .pr-root; Back closes; layout stays mounted', async () => {
    const wrapper = mount(ProfilingReport, {
      props: {
        title: 'topo-fs',
        swimlaneModel: { processes: [], minTime: 0, maxTime: 1000 },
        reportModel: markRaw(topologyReport()),
      },
    });
    expect(wrapper.find('[data-testid="topology-fullscreen-overlay"]').exists()).toBe(false);
    await wrapper.get('[data-testid="topology-fullscreen"]').trigger('click');
    const overlay = wrapper.get('[data-testid="topology-fullscreen-overlay"]');
    expect(wrapper.get('[data-testid="profiling-report"]').element.contains(overlay.element)).toBe(
      true,
    );
    expect(overlay.find('[data-testid="memory-topology-panel"]').exists()).toBe(true);
    expect(wrapper.find('.pr-layout').exists()).toBe(true);
    expect(wrapper.findAll('[data-testid="no-timeline"]')).toHaveLength(0);
    const markerIds = wrapper
      .findAll('[data-testid="memory-topology-panel"] marker')
      .map((m) => m.attributes('id'));
    expect(wrapper.findAll('[data-testid="memory-topology-panel"]').length).toBe(2);
    expect(markerIds.length).toBeGreaterThan(1);
    expect(new Set(markerIds).size).toBe(markerIds.length);
    await wrapper.get('[data-testid="topology-fullscreen-back"]').trigger('click');
    expect(wrapper.find('[data-testid="topology-fullscreen-overlay"]').exists()).toBe(false);
    expect(wrapper.find('.pr-layout').exists()).toBe(true);
    expect(wrapper.findAll('[data-testid="no-timeline"]')).toHaveLength(0);

    await wrapper.get('[data-testid="topology-fullscreen"]').trigger('click');
    expect(wrapper.find('[data-testid="topology-fullscreen-overlay"]').exists()).toBe(true);
    await wrapper.setProps({
      reportModel: markRaw({ ...topologyReport(), summary: { taskDurationUs: 99 } }),
    });
    expect(wrapper.find('[data-testid="topology-fullscreen-overlay"]').exists()).toBe(false);
    wrapper.unmount();
  });

  it('PR-ROOT-013: topology fullscreen show/hide uses a 200ms opacity+scale transition', async () => {
    const { flushPromises } = await import('@vue/test-utils');
    const src = (await import('./ProfilingReport.vue?raw')).default as string;
    expect(src).toMatch(/<Transition[^>]*name="pr-topo-fs"/);
    expect(src).toMatch(/\.pr-topo-fs-enter-active,\s*\.pr-topo-fs-leave-active\s*\{[^}]*opacity\s+200ms\s+ease/s);
    expect(src).toMatch(/\.pr-topo-fs-enter-from,\s*\.pr-topo-fs-leave-to\s*\{[^}]*opacity:\s*0/s);
    expect(src).toMatch(/\.pr-topo-fs-enter-from,\s*\.pr-topo-fs-leave-to\s*\{[^}]*scale\(0\.98\)/s);
    expect(src).toMatch(/\.pr-topo-fs-leave-active\s*\{[^}]*pointer-events:\s*none/s);
    expect(src).toMatch(/prefers-reduced-motion:\s*reduce[\s\S]*?\.pr-topo-fs-enter-active/);

    const host = document.createElement('div');
    document.body.appendChild(host);
    const wrapper = mount(ProfilingReport, {
      attachTo: host,
      global: { stubs: { Transition: false } },
      props: {
        title: 'topo-fs-anim',
        swimlaneModel: { processes: [], minTime: 0, maxTime: 1000 },
        reportModel: markRaw(topologyReport()),
      },
    });
    try {
      await wrapper.get('[data-testid="topology-fullscreen"]').trigger('click');
      await nextTick();
      expect(wrapper.find('[data-testid="topology-fullscreen-overlay"]').exists()).toBe(true);

      // Close then reopen before leave settles — exercises the real @after-leave guard
      // (fails if after-leave nulls the model unconditionally).
      await wrapper.get('[data-testid="topology-fullscreen-back"]').trigger('click');
      await wrapper.get('[data-testid="topology-fullscreen"]').trigger('click');
      await nextTick();
      await flushPromises();
      expect(wrapper.find('[data-testid="topology-fullscreen-overlay"]').exists()).toBe(true);
      expect(
        wrapper.find('[data-testid="topology-fullscreen-overlay"] [data-testid="memory-topology-panel"]').exists(),
      ).toBe(true);

      // Mid-leave WASD: Back clears the open flag while the model is still held.
      await wrapper.get('[data-testid="topology-fullscreen-back"]').trigger('click');
      const span = () => wrapper.vm.viewState.endTime - wrapper.vm.viewState.startTime;
      expect(span()).toBe(1000);
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'w' }));
      await nextTick();
      expect(span()).toBe(1000);
      // Overlay may still be leaving in jsdom (no CSS transitionend); cover window is the WASD gate above.
    } finally {
      wrapper.unmount();
      host.remove();
    }
  });

  it('PR-ROOT-010: overlay right-click stays fullscreen and does not open memory CSV', async () => {
    const wrapper = mount(ProfilingReport, {
      props: {
        title: 'topo-fs-details',
        swimlaneModel: { processes: [], minTime: 0, maxTime: 1000 },
        reportModel: markRaw(topologyReport()),
      },
    });
    await wrapper.get('[data-testid="topology-fullscreen"]').trigger('click');
    await wrapper
      .get('[data-testid="topology-fullscreen-overlay"] [data-testid="memory-topology-panel"]')
      .trigger('contextmenu');
    expect(wrapper.find('[data-testid="topology-fullscreen-overlay"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="stats-memory"]').exists()).toBe(false);
    wrapper.unmount();
  });

  it('PR-ROOT-011: overlay dialog Escape closes; WASD leave the viewport idle', async () => {
    const host = document.createElement('div');
    document.body.appendChild(host);
    const wrapper = mount(ProfilingReport, {
      attachTo: host,
      props: {
        title: 'topo-fs-keys',
        swimlaneModel: { processes: [], minTime: 0, maxTime: 1000 },
        reportModel: markRaw(topologyReport()),
      },
    });
    try {
      await wrapper.get('[data-testid="topology-fullscreen"]').trigger('click');
      await nextTick();
      const overlay = wrapper.get('[data-testid="topology-fullscreen-overlay"]');
      expect(overlay.attributes('role')).toBe('dialog');
      expect(overlay.attributes('aria-modal')).toBe('true');
      expect(overlay.attributes('aria-labelledby')).toBe('pr-topo-fs-title');
      expect(document.activeElement).toBe(
        wrapper.get('[data-testid="topology-fullscreen-back"]').element,
      );

      const span = () => wrapper.vm.viewState.endTime - wrapper.vm.viewState.startTime;
      expect(span()).toBe(1000);
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'w' }));
      await nextTick();
      expect(span()).toBe(1000);

      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
      await nextTick();
      expect(wrapper.find('[data-testid="topology-fullscreen-overlay"]').exists()).toBe(false);
    } finally {
      wrapper.unmount();
      host.remove();
    }
  });

  it('PR-ROOT-012: host deep-reactive swimlaneModel is consumed raw (shallow)', async () => {
    const { isReactive, reactive } = await import('vue');
    const model = reactive({
      processes: [
        {
          id: 'p',
          name: 'P',
          threads: [
            {
              id: 't',
              name: 'T',
              events: [{ id: 'e', name: 'ev', startTime: 0, duration: 10 }],
            },
          ],
        },
      ],
      minTime: 0,
      maxTime: 10,
    });
    expect(isReactive(model)).toBe(true);

    const wrapper = mount(ProfilingReport, {
      props: {
        title: 'shallow-swim',
        swimlaneModel: model,
        reportModel: emptyReportViewModel(),
      },
    });
    await nextTick();

    // Source-level toRaw: what the timeline actually receives is not a Proxy.
    const timeline = wrapper.findComponent(TimelineView);
    const display = timeline.props('displaySwim')!;
    expect(isReactive(display)).toBe(false);
    expect(isReactive(display.processes[0]!.threads[0]!.events[0]!)).toBe(false);
    // Nothing collapsed → pin strip and body share one raw model.
    expect(display).toBe(timeline.props('pinSourceModel'));
  });

  it('PR-VIEW-016/017: W/S/A/D keys zoom and pan the timeline', async () => {
    const wrapper = mount(ProfilingReport, {
      props: {
        title: 'keyboard-nav',
        swimlaneModel: { processes: [], minTime: 0, maxTime: 1000 },
        reportModel: emptyReportViewModel(),
      },
    });
    const span = () => wrapper.vm.viewState.endTime - wrapper.vm.viewState.startTime;
    const start = () => wrapper.vm.viewState.startTime;
    expect(span()).toBe(1000);

    // W zooms in around center (no cursor set yet → viewport center).
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'w' }));
    await nextTick();
    expect(span()).toBeLessThan(1000);
    const zoomedSpan = span();

    // D pans right (later times enter from the right), within bounds.
    const beforePan = start();
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'd' }));
    await nextTick();
    expect(start()).toBeGreaterThan(beforePan);
    expect(span()).toBe(zoomedSpan);

    // A pans left back.
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'a' }));
    await nextTick();
    expect(start()).toBeLessThanOrEqual(beforePan + 1);

    // S zooms back out to the full span (clamped to bounds).
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 's' }));
    await nextTick();
    expect(span()).toBe(1000);
    wrapper.unmount();
  });

  it('W/S/A/D ignored while typing in the search field', async () => {
    const wrapper = mount(ProfilingReport, {
      props: {
        title: 'keyboard-guard',
        swimlaneModel: { processes: [], minTime: 0, maxTime: 1000 },
        reportModel: emptyReportViewModel(),
      },
    });
    const span = () => wrapper.vm.viewState.endTime - wrapper.vm.viewState.startTime;
    const input = wrapper.find('[data-testid="search-input"]').element as HTMLInputElement;
    input.focus();
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'w', bubbles: true }));
    await nextTick();
    expect(span()).toBe(1000);
    wrapper.unmount();
  });
});
