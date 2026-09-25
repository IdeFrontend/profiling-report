import { describe, expect, it, vi } from 'vitest';
import { markRaw, nextTick } from 'vue';
import { mount } from '@vue/test-utils';
import ProfilingReport from './ProfilingReport.vue';
import TimelineView from '../TimelineView/TimelineView.vue';
import ContextMenu from '../ContextMenu/ContextMenu.vue';
import { emptyReportViewModel } from '../../adapters/adaptRep';
import { firstLabelledMemoryTopology } from '../../adapters/memoryTopology';
import { topologyFromArchDiagramMetrics } from '../../adapters/emulateMemoryTopology';
import { CANNBOT_PROMPT } from '../../domain/cannbot';
import type { CannbotPayload } from '../../domain/cannbot';
import type { SwimlaneModel } from '../../domain/types';
import { DOCK_HEIGHT_COLLAPSED, DOCK_HEIGHT_EXPANDED } from '../panelResize';

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
  const memoryTables = [
    {
      fileName: 'Memory.csv',
      headers: ['block_id', 'aiv_gm_to_ub_bw(GB/s)'],
      rows: [{ block_id: '0', 'aiv_gm_to_ub_bw(GB/s)': '1.2' }],
      blockIds: ['0'],
    },
  ];
  return {
    ...emptyReportViewModel(),
    summary: { taskDurationUs: 1 },
    memoryTables,
    // The adapter's `All` snapshot (PR-VM-012) — the aside reads it, it does not derive it.
    memoryTopology: firstLabelledMemoryTopology(memoryTables)!.model,
    csvTexts: { 'Memory.csv': 'block_id,aiv_gm_to_ub_bw(GB/s)\n0,1.2\n' },
  };
}

/** Emulate ArchDiagramMetrics — drawable topology + Metric modes (PR-ROOT-019). */
function archDiagramReport() {
  const archCsv = [
    'ArchDiagramId,ArchDiagramParameterName,ArchDiagramParameterValue',
    '1,l2_cached_ratio,50',
    '2,hbm_to_l2_syn_gbs,1.5',
    '3,hbm_to_l2_syn_cnt,8',
    '4,hbm_to_l2_syn_ratio,0.25',
  ].join('\n');
  const topo = topologyFromArchDiagramMetrics(archCsv)!;
  return {
    ...emptyReportViewModel(),
    profile: 'emulate' as const,
    memoryTopology: topo,
    csvTexts: { 'ArchDiagramMetrics.csv': archCsv },
    memoryTables: [
      {
        fileName: 'ArchDiagramMetrics.csv',
        headers: ['ArchDiagramId', 'ArchDiagramParameterName', 'ArchDiagramParameterValue'],
        rows: [],
        blockIds: [],
      },
    ],
  };
}

describe('ProfilingReport scaffold', () => {
  it('PR-CTXMENU-011: leaf-gutter context menu reaches the report root', async () => {
    const wrapper = mount(ProfilingReport, {
      attachTo: document.body,
      props: { swimlaneModel: depsModel(), reportModel: emptyReportViewModel() },
    });

    await wrapper.get('[data-testid="gutter-lane-t-0"]').trigger('contextmenu', {
      clientX: 10,
      clientY: 20,
    });
    await nextTick();

    expect(document.querySelector('[data-testid="context-menu"]')).not.toBeNull();
    wrapper.unmount();
  });

  it('PR-CTXMENU-003: Reset zoom is available off-event only outside the total range', async () => {
    vi.stubGlobal('matchMedia', () => ({ matches: true }));
    const wrapper = mount(ProfilingReport, {
      attachTo: document.body,
      props: { swimlaneModel: depsModel(), reportModel: emptyReportViewModel() },
    });

    // Zoom in while the menu is closed so the W key reaches the app's handler.
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'w' }));
    await nextTick();

    await wrapper.get('[data-testid="gutter-lane-t-0"]').trigger('contextmenu', {
      clientX: 10,
      clientY: 20,
    });
    await nextTick();
    expect(document.querySelector('[data-testid="ctx-item-reset"]')).not.toBeNull();

    document.querySelector<HTMLButtonElement>('[data-testid="ctx-item-reset"]')!.click();
    await nextTick();
    expect(wrapper.vm.viewState.startTime).toBe(0);
    expect(wrapper.vm.viewState.endTime).toBe(1000);

    // Back at the full range, a fresh menu omits Reset zoom.
    await wrapper.get('[data-testid="gutter-lane-t-0"]').trigger('contextmenu', {
      clientX: 10,
      clientY: 20,
    });
    await nextTick();
    expect(document.querySelector('[data-testid="ctx-item-reset"]')).toBeNull();

    wrapper.unmount();
    vi.unstubAllGlobals();
  });

  it('PR-CTXMENU-016: opening the menu on an event keeps it highlighted until dismissed', async () => {
    const wrapper = mount(ProfilingReport, {
      attachTo: document.body,
      props: { swimlaneModel: depsModel(), reportModel: emptyReportViewModel() },
    });

    const target = { id: 'a', name: 'A', startTime: 0, duration: 10 };
    wrapper.findComponent(TimelineView).vm.$emit('context-menu', {
      x: 10,
      y: 10,
      laneId: 't-0',
      target,
    });
    await nextTick();
    expect(wrapper.vm.viewState.hoveredEventId).toBe('a');

    // Programmatic scroll dismisses the menu and clears its pinned event highlight.
    wrapper.findComponent(TimelineView).vm.$emit('update:scrollY', 10);
    await nextTick();
    expect(wrapper.vm.viewState.hoveredEventId).toBeNull();
    expect(wrapper.vm.viewState.scrollY).toBe(10);
    wrapper.unmount();
  });

  it('PR-CTXMENU-016: scroll with the menu closed does not clear hoveredEventId', async () => {
    const wrapper = mount(ProfilingReport, {
      attachTo: document.body,
      props: { swimlaneModel: depsModel(), reportModel: emptyReportViewModel() },
    });

    const target = { id: 'a', name: 'A', startTime: 0, duration: 10 };
    wrapper.findComponent(TimelineView).vm.$emit('hover', target, 12, 24);
    await nextTick();
    expect(wrapper.vm.viewState.hoveredEventId).toBe('a');

    // Ordinary wheel scroll-y must not call dismiss — canvas does not re-emit hover.
    wrapper.findComponent(TimelineView).vm.$emit('update:scrollY', 10);
    await nextTick();
    expect(wrapper.vm.viewState.hoveredEventId).toBe('a');
    expect(wrapper.vm.viewState.scrollY).toBe(10);
    wrapper.unmount();
  });

  it('PR-ROOT-018: same-id hover does not clone viewState', async () => {
    const wrapper = mount(ProfilingReport, {
      props: { swimlaneModel: depsModel(), reportModel: emptyReportViewModel() },
    });
    const ev = { id: 'a', name: 'A', startTime: 0, duration: 10 };
    const timeline = wrapper.findComponent(TimelineView);
    timeline.vm.$emit('hover', ev, 12, 24);
    await nextTick();
    const first = wrapper.vm.viewState;
    timeline.vm.$emit('hover', ev, 40, 50);
    await nextTick();
    expect(wrapper.vm.viewState).toBe(first);
    expect(wrapper.vm.viewState.hoveredEventId).toBe('a');
    wrapper.unmount();
  });

  it('PR-CTXMENU-018: Shift+P toggles the hovered lane pin globally (menu closed)', async () => {
    const wrapper = mount(ProfilingReport, {
      attachTo: document.body,
      props: { swimlaneModel: depsModel(), reportModel: emptyReportViewModel() },
    });

    wrapper.findComponent(TimelineView).vm.$emit('hover-lane', 't-0');
    await nextTick();

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'P', shiftKey: true }));
    await nextTick();
    expect(wrapper.vm.viewState.pinnedLaneIds).toContain('t-0');

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'P', shiftKey: true }));
    await nextTick();
    expect(wrapper.vm.viewState.pinnedLaneIds).not.toContain('t-0');
    wrapper.unmount();
  });

  it('PR-CTXMENU-012: Show on a single-task summary bar selects its underlying leaf', async () => {
    const leaf = { id: 'leaf-1', name: 'busy', startTime: 0, duration: 10 };
    const summary = {
      id: 'folder/summary/0',
      name: 'busy',
      startTime: 0,
      duration: 10,
      taskCount: 1,
      sourceEvent: leaf,
    };
    const swimlaneModel = {
      processes: [
        {
          id: 'p-0',
          name: 'Card0',
          threads: [
            {
              id: 'folder',
              name: '计算',
              events: [],
              // Real leaf under the folder so findEventInModel resolves `sourceEvent`
              // (a collapsed folder's summaryEvents mirror its actual leaf events).
              children: [{ id: 'leaf-thread', name: 'T', events: [leaf] }],
              summaryEvents: [summary],
            },
          ],
        },
      ],
      minTime: 0,
      maxTime: 1000,
    };
    const wrapper = mount(ProfilingReport, {
      attachTo: document.body,
      props: { swimlaneModel, reportModel: emptyReportViewModel() },
    });

    // Bypass canvas hit-testing: emit the action ContextMenu would fire for a
    // right-clicked summary bar (`target` = the summary event, not the leaf).
    wrapper.findComponent(ContextMenu).vm.$emit('action', {
      command: 'show',
      laneId: 'folder',
      target: summary,
    });
    await nextTick();

    expect(wrapper.vm.viewState.selectedEventId).toBe('leaf-1');
    wrapper.unmount();
  });

  it('PR-CTXMENU-012: Show on a multi-task summary bar preserves the existing selection', async () => {
    const leaf = { id: 'leaf-1', name: 'busy', startTime: 0, duration: 10 };
    const summary = {
      id: 'folder/summary/0',
      name: 'busy',
      startTime: 0,
      duration: 10,
      taskCount: 4,
    };
    const swimlaneModel = {
      processes: [
        {
          id: 'p-0',
          name: 'Card0',
          threads: [
            {
              id: 'folder',
              name: '计算',
              events: [],
              children: [{ id: 'leaf-thread', name: 'T', events: [leaf] }],
              summaryEvents: [summary],
            },
          ],
        },
      ],
      minTime: 0,
      maxTime: 1000,
    };
    const wrapper = mount(ProfilingReport, {
      attachTo: document.body,
      props: { swimlaneModel, reportModel: emptyReportViewModel() },
    });

    // Select a real leaf first, so the multi-task summary Show has a selection to clear.
    wrapper.findComponent(ContextMenu).vm.$emit('action', {
      command: 'show',
      laneId: 'leaf-thread',
      target: leaf,
    });
    await nextTick();
    expect(wrapper.vm.viewState.selectedEventId).toBe('leaf-1');

    // Show on a multi-task summary (no sourceEvent) must dismiss without clearing.
    wrapper.findComponent(ContextMenu).vm.$emit('action', {
      command: 'show',
      laneId: 'folder',
      target: summary,
    });
    await nextTick();

    expect(wrapper.vm.viewState.selectedEventId).toBe('leaf-1');
    wrapper.unmount();
  });

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
    const layoutSrc = (await import('../ReportLayout/ReportLayout.vue?raw')).default as string;
    // `.pr-main` (ReportLayout) is `z-index: 1`; the dock must sit above it or the
    // full-height cursor stem (CursorTimestamp, `height: 100vh`) paints over the dock.
    expect(layoutSrc).toMatch(/\.pr-main\s*\{[^}]*z-index:\s*1\b/s);
    expect(src).toMatch(/\.pr-dock\s*\{[^}]*z-index:\s*[2-9]\b/);
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
    // The table stays mounted (dimmed) while the marquee grows instead of unmounting.
    expect(wrapper.find('.pr-multi-select__table').exists()).toBe(true);
    expect(wrapper.find('.pr-multi-select__table--dimmed').exists()).toBe(true);
    expect(vm.viewState.selectedEventId).toBe('a');
    expect(vm.viewState.multiSelectedIds).toEqual([]);
    expect(wrapper.emitted('select')?.length ?? 0).toBe(selectBefore);

    // Empty mid-drag clears stale Detail/Summary and shows the empty message.
    timeline().vm.$emit('multi-select-preview', []);
    await nextTick();
    expect(wrapper.find('[data-testid="multi-select-summary"]').exists()).toBe(false);
    expect(wrapper.find('[data-testid="detail-panel"]').exists()).toBe(false);
    expect(wrapper.find('[data-testid="dock-empty"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="dock"]').exists()).toBe(true);

    timeline().vm.$emit('multi-select', events);
    await nextTick();
    expect(wrapper.find('[data-testid="multi-select-summary"]').exists()).toBe(true);
    expect(wrapper.find('.pr-multi-select__table').exists()).toBe(true);
    expect(vm.viewState.multiSelectedIds).toEqual(['a', 'b']);
    expect(wrapper.emitted('select')?.at(-1)).toEqual([null]);

    wrapper.unmount();
  });

  it('PR-ROOT-016: ids-only live ≥2 mounts header without assigning events', async () => {
    const wrapper = mount(ProfilingReport, {
      props: {
        title: 'live-preview-ids',
        swimlaneModel: depsModel(),
        reportModel: emptyReportViewModel(),
      },
    });
    const vm = wrapper.vm as unknown as {
      viewState: { selectedEventId: string | null; multiSelectedIds: string[] };
    };
    const timeline = () => wrapper.findComponent({ name: 'TimelineView' });
    const selectBefore = wrapper.emitted('select')?.length ?? 0;

    timeline().vm.$emit('multi-select-preview', ['a', 'b']);
    await nextTick();
    expect(wrapper.find('[data-testid="multi-select-summary"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="detail-panel"]').exists()).toBe(false);
    // Ids-only preview does not resolve events: the table stays mounted but empty + dimmed.
    expect(wrapper.find('.pr-multi-select__table').exists()).toBe(true);
    expect(wrapper.find('.pr-multi-select__table--dimmed').exists()).toBe(true);
    const summary = wrapper.findComponent({ name: 'MultiSelectSummary' });
    expect(summary.props('selectedEvents')).toEqual([]);
    expect(summary.props('liveCount')).toBe(2);
    expect(summary.props('livePreview')).toBe(true);
    expect(summary.props('dimmed')).toBe(true);
    expect(vm.viewState.selectedEventId).toBeNull();
    expect(vm.viewState.multiSelectedIds).toEqual([]);
    expect(wrapper.emitted('select')?.length ?? 0).toBe(selectBefore);

    wrapper.unmount();
  });

  it('PR-ROOT-020: closed-to-drag uses preview dock height; commit grows to session height', async () => {
    const wrapper = mount(ProfilingReport, {
      props: {
        title: 'live-preview-height',
        swimlaneModel: depsModel(),
        reportModel: emptyReportViewModel(),
      },
    });
    const model = depsModel();
    const events = model.processes[0]!.threads[0]!.events;
    const timeline = () => wrapper.findComponent({ name: 'TimelineView' });
    const { DOCK_HEIGHT_MARQUEE_PREVIEW, DOCK_HEIGHT_COLLAPSED } = await import('../panelResize');

    timeline().vm.$emit('multi-select-preview', events);
    await nextTick();
    const dock = wrapper.get('[data-testid="dock"]');
    // jsdom wrap is empty of slack → minimum preview height.
    expect(dock.attributes('style')).toContain(`--pr-dock-h: ${DOCK_HEIGHT_MARQUEE_PREVIEW}px`);

    timeline().vm.$emit('multi-select', events);
    await nextTick();
    expect(wrapper.get('[data-testid="dock"]').attributes('style')).toContain(
      `--pr-dock-h: ${DOCK_HEIGHT_COLLAPSED}px`,
    );

    wrapper.unmount();
  });

  it('PR-ROOT-020: expand survives clear then closed-to-drag marquee commit', async () => {
    const wrapper = mount(ProfilingReport, {
      props: {
        title: 'dock-expand-preserved',
        swimlaneModel: depsModel(),
        reportModel: emptyReportViewModel(),
      },
    });
    const vm = wrapper.vm as unknown as { selectEventById: (id: string) => void };
    const model = depsModel();
    const events = model.processes[0]!.threads[0]!.events;
    const timeline = () => wrapper.findComponent({ name: 'TimelineView' });
    const { DOCK_HEIGHT_EXPANDED, DOCK_HEIGHT_MARQUEE_PREVIEW } = await import('../panelResize');

    vm.selectEventById('a');
    await nextTick();
    wrapper.getComponent({ name: 'DetailPanel' }).vm.$emit('update:height', DOCK_HEIGHT_EXPANDED);
    await nextTick();
    expect(wrapper.get('[data-testid="dock"]').attributes('style')).toContain(
      `--pr-dock-h: ${DOCK_HEIGHT_EXPANDED}px`,
    );

    // Clear selection — dock unmounts; session height must stay expanded.
    wrapper.getComponent({ name: 'DetailPanel' }).vm.$emit('close');
    await nextTick();
    expect(wrapper.find('[data-testid="dock"]').exists()).toBe(false);

    timeline().vm.$emit('multi-select-preview', events);
    await nextTick();
    expect(wrapper.get('[data-testid="dock"]').attributes('style')).toContain(
      `--pr-dock-h: ${DOCK_HEIGHT_MARQUEE_PREVIEW}px`,
    );
    // Chevron follows session expand even when painted height is slack-capped.
    expect(wrapper.get('[data-testid="multi-select-expander"]').attributes('aria-expanded')).toBe(
      'true',
    );

    timeline().vm.$emit('multi-select', events);
    await nextTick();
    expect(wrapper.get('[data-testid="dock"]').attributes('style')).toContain(
      `--pr-dock-h: ${DOCK_HEIGHT_EXPANDED}px`,
    );
    expect(wrapper.find('[data-testid="multi-select-summary"]').exists()).toBe(true);
    expect(wrapper.get('[data-testid="multi-select-expander"]').attributes('aria-expanded')).toBe(
      'true',
    );

    wrapper.unmount();
  });

  it('PR-ROOT-020: closed-to-drag preview grows into slack toward session target', async () => {
    const panelResize = await import('../panelResize');
    const { DOCK_HEIGHT_MARQUEE_PREVIEW, DOCK_HEIGHT_COLLAPSED, DOCK_HEIGHT_EXPANDED } =
      panelResize;
    const slackHeight = 180;
    const spy = vi.spyOn(panelResize, 'marqueePreviewDockHeight').mockReturnValue(slackHeight);

    const wrapper = mount(ProfilingReport, {
      props: {
        title: 'live-preview-slack',
        swimlaneModel: depsModel(),
        reportModel: emptyReportViewModel(),
      },
      attachTo: document.body,
    });
    const vm = wrapper.vm as unknown as { selectEventById: (id: string) => void };
    const model = depsModel();
    const events = model.processes[0]!.threads[0]!.events;
    const timeline = () => wrapper.findComponent({ name: 'TimelineView' });

    // Seed session expanded, then clear so closed→drag uses expanded as target.
    vm.selectEventById('a');
    await nextTick();
    wrapper.getComponent({ name: 'DetailPanel' }).vm.$emit('update:height', DOCK_HEIGHT_EXPANDED);
    await nextTick();
    wrapper.getComponent({ name: 'DetailPanel' }).vm.$emit('close');
    await nextTick();
    spy.mockClear();

    timeline().vm.$emit('multi-select-preview', events);
    await nextTick();

    // First paint must already be the precomputed preview (no full-target→shrink flash).
    const style = wrapper.get('[data-testid="dock"]').attributes('style') ?? '';
    expect(spy).toHaveBeenCalled();
    const targetHeights = spy.mock.calls.map((c) => (c[0] as { targetHeight: number }).targetHeight);
    expect(targetHeights.every((h) => h === DOCK_HEIGHT_EXPANDED)).toBe(true);
    expect(style).toContain(`--pr-dock-h: ${slackHeight}px`);
    expect(style).not.toContain(`--pr-dock-h: ${DOCK_HEIGHT_MARQUEE_PREVIEW}px`);
    expect(style).not.toContain(`--pr-dock-h: ${DOCK_HEIGHT_COLLAPSED}px`);
    expect(style).not.toContain(`--pr-dock-h: ${DOCK_HEIGHT_EXPANDED}px`);
    expect(slackHeight).toBeLessThan(DOCK_HEIGHT_COLLAPSED);
    expect(wrapper.get('[data-testid="multi-select-expander"]').attributes('aria-expanded')).toBe(
      'true',
    );

    spy.mockRestore();
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

  it('PR-ROOT-016: empty-first from closed does not mount the dock', async () => {
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
    expect(wrapper.find('[data-testid="dock-empty"]').exists()).toBe(false);
    expect(wrapper.find('[data-testid="multi-select-summary"]').exists()).toBe(false);
    expect(wrapper.find('[data-testid="detail-panel"]').exists()).toBe(false);
    // Gesture is live (Escape gated) even with empty coverage and no dock.
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    await nextTick();
    expect(wrapper.emitted('select')).toBeFalsy();

    wrapper.unmount();
  });

  it('PR-ROOT-016: empty-only live marquee Escape restores a committed multi dock', async () => {
    const wrapper = mount(ProfilingReport, {
      props: {
        title: 'live-preview-empty-over-multi',
        swimlaneModel: depsModel(),
        reportModel: emptyReportViewModel(),
      },
    });
    const vm = wrapper.vm as unknown as {
      viewState: { selectedEventId: string | null; multiSelectedIds: string[] };
    };
    const model = depsModel();
    const events = model.processes[0]!.threads[0]!.events;
    const timeline = () => wrapper.findComponent({ name: 'TimelineView' });

    timeline().vm.$emit('multi-select', events);
    await nextTick();
    expect(wrapper.find('[data-testid="multi-select-summary"]').exists()).toBe(true);
    expect(vm.viewState.multiSelectedIds).toEqual(['a', 'b']);
    const selectAfterCommit = wrapper.emitted('select')?.length ?? 0;

    // Empty live rect over committed multi: clear stale rows, keep dock with empty message.
    timeline().vm.$emit('multi-select-preview', []);
    await nextTick();
    expect(wrapper.find('[data-testid="dock-empty"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="multi-select-summary"]').exists()).toBe(false);
    expect(vm.viewState.multiSelectedIds).toEqual(['a', 'b']);

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    await nextTick();
    expect(wrapper.emitted('select')?.length ?? 0).toBe(selectAfterCommit);
    expect(vm.viewState.multiSelectedIds).toEqual(['a', 'b']);

    timeline().vm.$emit('multi-select-preview', null);
    await nextTick();
    expect(wrapper.find('[data-testid="multi-select-summary"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="dock-empty"]').exists()).toBe(false);
    expect(vm.viewState.multiSelectedIds).toEqual(['a', 'b']);
    expect(wrapper.emitted('select')?.length ?? 0).toBe(selectAfterCommit);

    wrapper.unmount();
  });

  it('PR-ROOT-016: a growing marquee dims the stale table, then recalculates after the settle window', async () => {
    vi.useFakeTimers();
    const model = depsModel();
    model.processes[0]!.threads[0]!.events.push({
      id: 'c',
      name: 'C',
      startTime: 40,
      duration: 10,
      dependencies: { predecessors: [], successors: [] },
    });
    const wrapper = mount(ProfilingReport, {
      props: {
        title: 'live-preview-first-multi',
        swimlaneModel: model,
        reportModel: emptyReportViewModel(),
      },
    });
    const events = model.processes[0]!.threads[0]!.events;
    const timeline = () => wrapper.findComponent({ name: 'TimelineView' });

    timeline().vm.$emit('multi-select', [events[0]!, events[1]!]);
    await nextTick();
    expect(wrapper.find('[data-testid="multi-select-summary"]').exists()).toBe(true);
    expect(wrapper.find('.pr-multi-select__table--dimmed').exists()).toBe(false);

    // New gesture over a different ≥2 set: table stays stale + dimmed (no immediate recalc).
    timeline().vm.$emit('multi-select-preview', [events[1]!, events[2]!]);
    await nextTick();
    const summary = () => wrapper.findComponent({ name: 'MultiSelectSummary' });
    expect(summary().exists()).toBe(true);
    expect(
      (summary().props('selectedEvents') as { id: string }[]).map((e) => e.id),
    ).toEqual(['a', 'b']);
    expect(summary().props('livePreview')).toBe(true);
    expect(summary().props('dimmed')).toBe(true);
    expect(wrapper.find('.pr-multi-select__table--dimmed').exists()).toBe(true);

    // After the 200ms settle, the root resolves the live ids and recalculates.
    vi.advanceTimersByTime(200);
    await nextTick();
    expect(
      (summary().props('selectedEvents') as { id: string }[]).map((e) => e.id),
    ).toEqual(['b', 'c']);
    expect(summary().props('dimmed')).toBe(false);
    expect(wrapper.find('.pr-multi-select__table--dimmed').exists()).toBe(false);

    vi.useRealTimers();
    wrapper.unmount();
  });

  it('PR-ROOT-016: a late settle never wipes the committed selection', async () => {
    vi.useFakeTimers();
    const model = depsModel();
    const wrapper = mount(ProfilingReport, {
      props: {
        title: 'live-preview-settle-commit',
        swimlaneModel: model,
        reportModel: emptyReportViewModel(),
      },
    });
    const events = model.processes[0]!.threads[0]!.events;
    const timeline = () => wrapper.findComponent({ name: 'TimelineView' });
    const summary = () => wrapper.findComponent({ name: 'MultiSelectSummary' });

    timeline().vm.$emit('multi-select-preview', events);
    await nextTick();
    expect(summary().props('dimmed')).toBe(true);

    // Commit before the settle fires: clearMarqueeLive cancels the pending timer, and the
    // `marqueeLive` guard in the settle callback covers the fired-but-queued window.
    timeline().vm.$emit('multi-select', events);
    await nextTick();
    expect((summary().props('selectedEvents') as { id: string }[]).map((e) => e.id)).toEqual([
      'a',
      'b',
    ]);
    expect(summary().props('dimmed')).toBe(false);

    // Any late settle must be a no-op on the committed rows.
    vi.advanceTimersByTime(200);
    await nextTick();
    expect((summary().props('selectedEvents') as { id: string }[]).map((e) => e.id)).toEqual([
      'a',
      'b',
    ]);
    expect(summary().props('dimmed')).toBe(false);

    vi.useRealTimers();
    wrapper.unmount();
  });

  it('PR-ROOT-020: slack preview ignores live scrollY after gesture start', async () => {
    const model = depsModel();
    const wrapper = mount(ProfilingReport, {
      props: {
        title: 'frozen-scroll-slack',
        swimlaneModel: model,
        reportModel: emptyReportViewModel(),
      },
    });
    const events = model.processes[0]!.threads[0]!.events;
    const timeline = () => wrapper.findComponent({ name: 'TimelineView' });
    const panelResize = await import('../panelResize');
    const spy = vi.spyOn(panelResize, 'marqueePreviewDockHeight').mockReturnValue(120);

    timeline().vm.$emit('multi-select-preview', events);
    await nextTick();
    const callsAtOpen = spy.mock.calls.length;
    expect(callsAtOpen).toBeGreaterThan(0);
    const scrollAtOpen = spy.mock.calls.at(-1)![0]!.scrollY as number;

    // Edge autoscroll updates view scroll; slack watch must not recompute from live scrollY.
    const vm = wrapper.vm as unknown as {
      viewState: { scrollY: number };
    };
    vm.viewState.scrollY = scrollAtOpen + 400;
    await nextTick();
    expect(spy.mock.calls.length).toBe(callsAtOpen);

    spy.mockRestore();
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

  it('no timeline: the 性能分析 trigger still mounts the hints dock', async () => {
    const wrapper = mount(ProfilingReport, {
      props: {
        title: 'hints-no-timeline',
        swimlaneModel: undefined,
        reportModel: {
          ...emptyReportViewModel(),
          performanceHints: [
            {
              message:
                'UB bank conflicts detected. Try to optimize local memory accesses, prefer sequential patterns instead of strided.',
              typeName: 'shared_bank_conflicts',
              origin: 'kernel',
            },
          ],
        },
        capabilities: ['performanceHints'],
      },
    });

    // No swimlaneModel → timeline absent; DATA-33a keeps the hints-only aside closed.
    expect(wrapper.find('[data-testid="no-timeline"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="dock"]').exists()).toBe(false);
    await nextTick(); // first render opens the aside (default state); onMounted's DATA-33a reset closes it.
    expect(wrapper.find('[data-testid="stats-aside"]').exists()).toBe(false);

    // Manual toolbar toggle opens the aside; the hints entry renders once (non-csvOnly branch).
    await wrapper.get('[data-testid="toggle-aside"]').trigger('click');
    expect(wrapper.find('[data-testid="stats-aside"]').exists()).toBe(true);
    expect(wrapper.findAll('[data-testid="stats-performance-hints"]')).toHaveLength(0);
    expect(wrapper.findAll('[data-testid="performance-hints-trigger"]')).toHaveLength(1);

    // The trigger mounts the dock even though showTimeline is false.
    await wrapper.get('[data-testid="performance-hints-trigger"]').trigger('click');
    expect(wrapper.find('[data-testid="dock"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="performance-hints-dock"]').exists()).toBe(true);
    // The pane reuses the standard event-detail dock: no dedicated hints chrome on the shell.
    expect(wrapper.get('[data-testid="dock"]').classes()).not.toContain('pr-dock--hints');

    // The dock's own close button dismisses it again.
    await wrapper.get('[data-testid="performance-hints-close"]').trigger('click');
    expect(wrapper.find('[data-testid="performance-hints-dock"]').exists()).toBe(false);
    expect(wrapper.find('.pr-dock--hints').exists()).toBe(false);
  });

  it('PR-ROOT-022: the 性能分析 trigger clears the selection so the hints pane owns the dock', async () => {
    const wrapper = mount(ProfilingReport, {
      props: {
        title: 'hints-over-selection',
        swimlaneModel: depsModel(),
        reportModel: {
          ...emptyReportViewModel(),
          summary: { opName: 'gelu', opType: 'vector', taskDurationUs: 120 },
          performanceHints: [
            {
              message: 'Low warp occupancy detected (32.5%).',
              typeName: 'warp_occupancy_hint',
              pc: '624191680372',
              origin: 'instruction',
            },
          ],
        },
        capabilities: ['performanceHints'],
      },
    });
    const vm = wrapper.vm as unknown as {
      selectEventById: (id: string) => void;
      viewState: { selectedEventId: string | null; multiSelectedIds: string[] };
    };

    // The duration card auto-opens the aside, so its 性能分析 trigger is on screen.
    expect(wrapper.find('[data-testid="performance-hints-trigger"]').exists()).toBe(true);

    // Selection first: DetailPanel owns the dock slot, so the pane would be swallowed.
    vm.selectEventById('a');
    await nextTick();
    expect(wrapper.find('[data-testid="detail-panel"]').exists()).toBe(true);

    await wrapper.get('[data-testid="performance-hints-trigger"]').trigger('click');
    await nextTick();
    expect(wrapper.find('[data-testid="detail-panel"]').exists()).toBe(false);
    expect(vm.viewState.selectedEventId).toBeNull();
    expect(wrapper.emitted('select')?.at(-1)).toEqual([null]);
    expect(wrapper.find('[data-testid="performance-hints-dock"]').exists()).toBe(true);
    expect(wrapper.get('[data-testid="dock"]').classes()).not.toContain('pr-dock--hints');

    // A later single select clears sticky hintsDockOpen — closing DetailPanel must not
    // resurrect the hints pane without another 性能分析 click.
    vm.selectEventById('a');
    await nextTick();
    expect(wrapper.find('[data-testid="detail-panel"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="performance-hints-dock"]').exists()).toBe(false);
    await wrapper.get('[data-testid="detail-panel-close"]').trigger('click');
    await nextTick();
    expect(wrapper.find('[data-testid="detail-panel"]').exists()).toBe(false);
    expect(wrapper.find('[data-testid="performance-hints-dock"]').exists()).toBe(false);

    // Re-open hints, then a committed marquee owns the slot and also clears sticky open.
    await wrapper.get('[data-testid="performance-hints-trigger"]').trigger('click');
    await nextTick();
    expect(wrapper.find('[data-testid="performance-hints-dock"]').exists()).toBe(true);
    const model = depsModel();
    const events = model.processes[0]!.threads[0]!.events;
    wrapper.findComponent({ name: 'TimelineView' }).vm.$emit('multi-select', events);
    await nextTick();
    expect(wrapper.find('[data-testid="multi-select-summary"]').exists()).toBe(true);
    expect(wrapper.get('[data-testid="dock"]').classes()).not.toContain('pr-dock--hints');
    expect(wrapper.find('[data-testid="performance-hints-dock"]').exists()).toBe(false);

    // Closing the multi summary must not resurrect hints either.
    await wrapper.get('[data-testid="multi-select-close"]').trigger('click');
    await nextTick();
    expect(wrapper.find('[data-testid="multi-select-summary"]').exists()).toBe(false);
    expect(wrapper.find('[data-testid="performance-hints-dock"]').exists()).toBe(false);

    // Trigger still works after sticky clear.
    await wrapper.get('[data-testid="performance-hints-trigger"]').trigger('click');
    await nextTick();
    expect(vm.viewState.multiSelectedIds).toEqual([]);
    expect(wrapper.find('[data-testid="performance-hints-dock"]').exists()).toBe(true);
    expect(wrapper.get('[data-testid="dock"]').classes()).not.toContain('pr-dock--hints');

    wrapper.unmount();
  });

  it('PR-ROOT-020: environment routes the 性能分析 trigger — vscode asks the host to open Problems, browser opens the internal dock', async () => {
    const hintRow = {
      message: 'UB bank conflicts detected. Try to optimize local memory accesses.',
      typeName: 'shared_bank_conflicts',
      origin: 'kernel',
    } as const;

    const vscodeWrapper = mount(ProfilingReport, {
      props: {
        title: 'hints-vscode',
        swimlaneModel: undefined,
        reportModel: {
          ...emptyReportViewModel(),
          performanceHints: [hintRow],
        },
        capabilities: ['performanceHints'],
        environment: 'vscode',
      },
    });

    // Hints-only report: the post-mount DATA-33a reset leaves the aside closed, so the
    // toolbar toggle is what opens it (same flow as the no-timeline test above).
    await nextTick();
    await vscodeWrapper.get('[data-testid="toggle-aside"]').trigger('click');
    await vscodeWrapper.get('[data-testid="performance-hints-trigger"]').trigger('click');

    expect(vscodeWrapper.emitted('open-performance-hints-in-problems')).toHaveLength(1);
    expect(vscodeWrapper.find('[data-testid="dock"]').exists()).toBe(false);

    const browserWrapper = mount(ProfilingReport, {
      props: {
        title: 'hints-browser',
        swimlaneModel: undefined,
        reportModel: {
          ...emptyReportViewModel(),
          performanceHints: [hintRow],
        },
        capabilities: ['performanceHints'],
        environment: 'browser',
      },
    });

    await nextTick();
    await browserWrapper.get('[data-testid="toggle-aside"]').trigger('click');
    await browserWrapper.get('[data-testid="performance-hints-trigger"]').trigger('click');

    expect(browserWrapper.emitted('open-performance-hints-in-problems')).toBeUndefined();
    expect(browserWrapper.find('[data-testid="performance-hints-dock"]').exists()).toBe(true);
    expect(browserWrapper.get('[data-testid="dock"]').classes()).not.toContain('pr-dock--hints');
  });

  it('PR-ROOT-021: the hints pane carries the shared dock expander and drives --pr-dock-h', async () => {
    const wrapper = mount(ProfilingReport, {
      props: {
        title: 'hints-expander',
        swimlaneModel: undefined,
        reportModel: {
          ...emptyReportViewModel(),
          performanceHints: [
            {
              message: 'UB bank conflicts detected. Try to optimize local memory accesses.',
              typeName: 'shared_bank_conflicts',
              origin: 'kernel',
            },
          ],
        },
        capabilities: ['performanceHints'],
        environment: 'browser',
      },
    });

    // Same browser flow as PR-ROOT-020: the hints-only report's DATA-33a aside reset means
    // the toolbar toggle opens the aside before the title-row 性能分析 trigger can be clicked.
    await nextTick();
    await wrapper.get('[data-testid="toggle-aside"]').trigger('click');
    await wrapper.get('[data-testid="performance-hints-trigger"]').trigger('click');

    const dock = wrapper.get('[data-testid="dock"]');
    const expander = wrapper.get('[data-testid="performance-hints-expander"]');
    expect(expander.attributes('aria-expanded')).toBe('false');
    expect(dock.attributes('style')).toContain(`--pr-dock-h: ${DOCK_HEIGHT_COLLAPSED}px`);

    await expander.trigger('click');
    expect(expander.attributes('aria-expanded')).toBe('true');
    expect(dock.attributes('style')).toContain(`--pr-dock-h: ${DOCK_HEIGHT_EXPANDED}px`);

    await expander.trigger('click');
    expect(expander.attributes('aria-expanded')).toBe('false');
    expect(dock.attributes('style')).toContain(`--pr-dock-h: ${DOCK_HEIGHT_COLLAPSED}px`);

    wrapper.unmount();
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
    // Compute memoryDiagram: no ArchDiagram Metric chrome on the overlay.
    expect(overlay.find('[data-testid="topology-fullscreen-metric-switcher"]').exists()).toBe(false);
    expect(wrapper.find('.pr-layout').exists()).toBe(true);
    expect(wrapper.findAll('[data-testid="no-timeline"]')).toHaveLength(0);
    // The chrome asset owns the arrows, so the panel no longer defines SVG <marker>s and
    // the stacked + overlay instances have no element ids to dedupe.
    expect(wrapper.findAll('[data-testid="memory-topology-panel"]').length).toBe(2);
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

  it('PR-ROOT-019: archDiagram Metric select appears in topology 全屏 and rebuilds labels', async () => {
    const wrapper = mount(ProfilingReport, {
      props: {
        title: 'topo-fs-metric',
        swimlaneModel: { processes: [], minTime: 0, maxTime: 1000 },
        reportModel: markRaw(archDiagramReport()),
        capabilities: ['archDiagram'],
      },
    });
    await wrapper.get('[data-testid="topology-fullscreen"]').trigger('click');
    const overlay = wrapper.get('[data-testid="topology-fullscreen-overlay"]');
    expect(overlay.find('[data-testid="topology-fullscreen-metric-switcher"]').exists()).toBe(true);
    expect(overlay.text()).toContain('1.50 GB/s');
    await overlay.get('[data-testid="topology-fs-metric-select"] .pr-metric-select__trigger').trigger('click');
    const opt = document.querySelector(
      '[data-testid="topology-fs-metric-option-number_of_requests"]',
    ) as HTMLElement | null;
    expect(opt).not.toBeNull();
    opt!.click();
    await nextTick();
    expect(overlay.text()).toContain('8');
    expect(overlay.text()).not.toContain('1.50 GB/s');
    // Shared mode: stacked aside Metric follows the fullscreen pick.
    expect(wrapper.get('[data-testid="topology-metric-select"]').attributes('data-value')).toBe(
      'number_of_requests',
    );
    wrapper.unmount();
  });

  it('PR-ROOT-019: fullscreen undrawable mode clears plates but keeps Metric select', async () => {
    const archCsv = [
      'ArchDiagramId,ArchDiagramParameterName,ArchDiagramParameterValue',
      '1,hbm_to_l2_syn_gbs,1.5',
    ].join('\n');
    const topo = topologyFromArchDiagramMetrics(archCsv)!;
    const wrapper = mount(ProfilingReport, {
      props: {
        title: 'topo-fs-empty-mode',
        swimlaneModel: { processes: [], minTime: 0, maxTime: 1000 },
        reportModel: markRaw({
          ...emptyReportViewModel(),
          profile: 'emulate' as const,
          memoryTopology: topo,
          csvTexts: { 'ArchDiagramMetrics.csv': archCsv },
          memoryTables: [
            {
              fileName: 'ArchDiagramMetrics.csv',
              headers: ['ArchDiagramId', 'ArchDiagramParameterName', 'ArchDiagramParameterValue'],
              rows: [],
              blockIds: [],
            },
          ],
        }),
        capabilities: ['archDiagram'],
      },
    });
    await wrapper.get('[data-testid="topology-fullscreen"]').trigger('click');
    expect(wrapper.get('[data-testid="topology-fullscreen-overlay"]').text()).toContain('1.50 GB/s');
    await wrapper
      .get('[data-testid="topology-fs-metric-select"] .pr-metric-select__trigger')
      .trigger('click');
    const opt = document.querySelector(
      '[data-testid="topology-fs-metric-option-number_of_requests"]',
    ) as HTMLElement | null;
    expect(opt).not.toBeNull();
    opt!.click();
    await nextTick();
    const overlay = wrapper.get('[data-testid="topology-fullscreen-overlay"]');
    expect(overlay.find('[data-testid="memory-topology-panel"]').exists()).toBe(false);
    expect(overlay.text()).not.toContain('1.50 GB/s');
    expect(overlay.find('[data-testid="topology-fullscreen-metric-switcher"]').exists()).toBe(true);
    await overlay.get('[data-testid="topology-fs-metric-select"] .pr-metric-select__trigger').trigger('click');
    const back = document.querySelector(
      '[data-testid="topology-fs-metric-option-bandwidth_per_operator"]',
    ) as HTMLElement | null;
    expect(back).not.toBeNull();
    back!.click();
    await nextTick();
    expect(wrapper.get('[data-testid="topology-fullscreen-overlay"]').text()).toContain('1.50 GB/s');
    expect(wrapper.find('[data-testid="memory-topology-panel"]').exists()).toBe(true);
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

  it('W/S/A/D and Shift+P are ignored while typing in the search field', async () => {
    const wrapper = mount(ProfilingReport, {
      props: {
        title: 'keyboard-guard',
        swimlaneModel: depsModel(),
        reportModel: emptyReportViewModel(),
      },
    });
    const span = () => wrapper.vm.viewState.endTime - wrapper.vm.viewState.startTime;
    wrapper.findComponent(TimelineView).vm.$emit('hover-lane', 't-0');
    const input = wrapper.find('[data-testid="search-input"]').element as HTMLInputElement;
    input.focus();
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'w', bubbles: true }));
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'P', shiftKey: true, bubbles: true }));
    await nextTick();
    expect(span()).toBe(1000);
    expect(wrapper.vm.viewState.pinnedLaneIds).toEqual([]);
    wrapper.unmount();
  });
});
