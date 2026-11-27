import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { defineComponent, h, markRaw, nextTick } from 'vue';
import { flushPromises, mount } from '@vue/test-utils';
import ProfilingReport from './ProfilingReport.vue';
import TimelineView from '../TimelineView/TimelineView.vue';
import SourceView from '../SourceView/SourceView.vue';
import SourceDiffView from '../SourceDiff/SourceDiffView.vue';
import ContextMenu from '../ContextMenu/ContextMenu.vue';
import ReportToolbar from '../ReportToolbar/ReportToolbar.vue';
import * as adapters from '../../adapters';
import { t } from '../../i18n';
import { emptyReportViewModel } from '../../adapters/adaptRep';
import { mockSourceCorrelation } from '../../adapters/sourceCorrelation/mockSourceCorrelation';
import { MISSING_SOURCE_EMBED_PREFIX } from '../../adapters/sourceCorrelation/resolveSourceFile';
import { resolveMissingSourceFiles, workspaceSourceResolver } from '../../adapters';
import { sourceWorkspaceFromTexts } from '../../export/stitchHtmlReport';
import { firstLabelledMemoryTopology } from '../../adapters/memoryTopology';
import { topologyFromArchDiagramMetrics } from '../../adapters/emulateMemoryTopology';
import { CANNBOT_PROMPT } from '../../domain/cannbot';
import type { CannbotPayload } from '../../domain/cannbot';
import type {
  AdaptedReport,
  Baseline,
  MemoryTopologyModel,
  ReportCapability,
  SourceCorrelationModel,
  SwimlaneModel,
} from '../../domain/types';
import { DOCK_HEIGHT_COLLAPSED, DOCK_HEIGHT_EXPANDED } from '../panelResize';

vi.mock('@sudu-ide/code-review', () => ({
  newWorkerPool: vi.fn(async () => ({ getNumThreads: () => 3 })),
  // Stateful caret: source-line echoes read it back after setPosition.
  newEditor: vi.fn(() => {
    let line = 1;
    return {
      setModel: vi.fn(),
      setVScrollListener: vi.fn(),
      setVScrollVisible: vi.fn(),
      setCaretListener: vi.fn(),
      setPosition: vi.fn((position: { lineNumber: number }) => {
        line = position.lineNumber;
      }),
      setTheme: vi.fn(),
      getPosition: vi.fn(() => ({ lineNumber: line, column: 1 })),
      highlightRanges: vi.fn(),
      revealLine: vi.fn(),
      revealLineInCenter: vi.fn(),
      focus: vi.fn(),
      dispose: vi.fn(),
      getDevicePixelRatio: () => 1,
      getLineHeight: () => 18,
      getEditorHeight: () => 200,
      getMaxVScrollPos: () => 0,
      getNumLines: () => 10,
      getFontSize: () => 12,
      getFontFamily: () => 'monospace',
      setVScrollPos: vi.fn(),
    };
  }),
  newTextModel: vi.fn(() => ({ dispose: vi.fn() })),
}));

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

function markedCorrelation(marker: string): SourceCorrelationModel {
  const base = { ...mockSourceCorrelation(), mock: false };
  return { ...base, files: [{ ...base.files[0]!, text: marker }] };
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

/** §11.2.3.2 — the topology carrier plus the heat carrier (Layout+Cells → `ub`). */
function heatmapReport() {
  const blocks = Array.from({ length: 32 }, (_, index) => ({
    index,
    state: index < 3 ? ('withData' as const) : ('withoutData' as const),
  }));
  return {
    ...topologyReport(),
    memoryHeatmap: {
      units: [
        {
          id: 'ub' as const,
          views: [
            {
              coreId: 0,
              coreTypeId: 2,
              ownerName: 'AIV0',
              memoryName: 'UB',
              columns: 8,
              rows: 4,
              blocks,
              totalBytes: 1024,
              usedBytes: 96,
              freeBytes: 928,
            },
          ],
        },
      ],
    },
  };
}

describe('ProfilingReport scaffold', () => {
  beforeEach(() => {
    // Keep source loads sync-ish in unit tests (real wasm init is covered elsewhere).
    vi.spyOn(adapters, 'ensurePcSamplingSql').mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

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

  it('PR-ROOT-023: the 性能分析 trigger clears the selection so the hints pane owns the dock', async () => {
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

  it('PR-ROOT-021: environment routes the 性能分析 trigger — vscode asks the host to open Problems, browser opens the internal dock', async () => {
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

  it('PR-ROOT-022: the hints pane carries the shared dock expander and drives --pr-dock-h', async () => {
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

    // Same browser flow as PR-ROOT-021: the hints-only report's DATA-33a aside reset means
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
    await flushPromises();

    expect(wrapper.find('[data-testid="op-selector"]').exists()).toBe(true);
    // Trigger shows the selected pack's first operator row, not the archive stem.
    expect(wrapper.find('[data-testid="op-selector-label"]').text()).toBe('add_custom (op1)');
    expect(wrapper.vm.selectedOperatorId).toBe('op1.npu.rep');

    await wrapper.find('[data-testid="op-selector"] button').trigger('click');
    const items = wrapper.findAll('[data-testid="op-item"]');
    expect(items).toHaveLength(2);
    expect(items.map((i) => i.text())).toEqual(['add_custom (op1)', 'add_custom (op2)']);
    expect(items[0].attributes('aria-selected')).toBe('true');
    await items[1].trigger('click');

    expect(wrapper.vm.selectedOperatorId).toBe('op2.npu.rep');
    expect(wrapper.find('[data-testid="op-selector-label"]').text()).toBe('add_custom (op2)');
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
      await flushPromises();
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
      await flushPromises();
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
      await flushPromises();
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

  it('PR-ROOT-034: 统计分析 shows for pipeTrace and catalog-absent; hides for communication and warpOccupy', async () => {
    const { vi } = await import('vitest');
    const adapters = await import('../../adapters');
    const swimPipe = {
      processes: [
        {
          id: 'p',
          name: 'P',
          threads: [
            {
              id: 't',
              name: 'pipe-lane',
              events: [{ id: 'ep', name: 'pipe-op', startTime: 0, duration: 10 }],
            },
          ],
        },
      ],
      minTime: 0,
      maxTime: 10,
    };
    const swimComm = {
      processes: [
        {
          id: 'p',
          name: 'P',
          threads: [
            {
              id: 't',
              name: 'comm-lane',
              events: [{ id: 'ec', name: 'comm-op', startTime: 0, duration: 50 }],
            },
          ],
        },
      ],
      minTime: 0,
      maxTime: 50,
    };
    const swimWarp = {
      processes: [
        {
          id: 'p',
          name: 'P',
          threads: [
            {
              id: 't',
              name: 'warp-lane',
              events: [{ id: 'ew', name: 'warp-op', startTime: 0, duration: 20 }],
            },
          ],
        },
      ],
      minTime: 0,
      maxTime: 20,
    };
    const overviewSeries = [
      { id: 'Cube', label: 'Cube', points: [{ t: 0, v: 1 }, { t: 10, v: 2 }] },
    ];
    const reportModel = { ...emptyReportViewModel(), overviewSeries };
    const spy = vi.spyOn(adapters, 'loadReportSource').mockReturnValue({
      swimlaneModel: swimPipe,
      reportModel,
      capabilities: [],
    });

    try {
      const legacy = mount(ProfilingReport, {
        props: { source: new ArrayBuffer(8) },
      });
      await flushPromises();
      expect(legacy.findComponent(TimelineView).props('showOverviewCharts')).toBe(true);
      expect(legacy.findComponent(TimelineView).props('overviewSeries')).toEqual(overviewSeries);
      legacy.unmount();

      spy.mockReturnValue({
        swimlaneModel: swimPipe,
        reportModel,
        capabilities: [],
        timelineTraces: [
          { id: 'communication', embedName: 'Communication.json' },
          { id: 'warpOccupy', embedName: 'SimtWarpOccupy.json' },
          { id: 'pipeTrace', embedName: 'PipeTrace.json' },
        ],
        selectedTimelineTraceId: 'pipeTrace',
        timelineTraceModels: {
          communication: swimComm,
          warpOccupy: swimWarp,
          pipeTrace: swimPipe,
        },
      });
      const wrapper = mount(ProfilingReport, {
        props: { source: new ArrayBuffer(8) },
      });
      await flushPromises();
      expect(wrapper.findComponent(TimelineView).props('showOverviewCharts')).toBe(true);

      await wrapper.find('[data-testid="toggle-timeline-trace"]').trigger('click');
      await wrapper.find('[data-trace-id="warpOccupy"]').trigger('click');
      expect(wrapper.findComponent(TimelineView).props('showOverviewCharts')).toBe(false);

      await wrapper.find('[data-testid="toggle-timeline-trace"]').trigger('click');
      await wrapper.find('[data-trace-id="communication"]').trigger('click');
      expect(wrapper.findComponent(TimelineView).props('showOverviewCharts')).toBe(false);

      await wrapper.find('[data-testid="toggle-timeline-trace"]').trigger('click');
      await wrapper.find('[data-trace-id="pipeTrace"]').trigger('click');
      expect(wrapper.findComponent(TimelineView).props('showOverviewCharts')).toBe(true);
    } finally {
      spy.mockRestore();
    }
  });

  it('PR-ROOT-031: multi-timeline source swaps swimlane via 流水视图显示; re-select is a no-op', async () => {
    const { vi } = await import('vitest');
    const adapters = await import('../../adapters');
    const swimPipe = {
      processes: [
        {
          id: 'p',
          name: 'P',
          threads: [
            {
              id: 't',
              name: 'pipe-lane',
              events: [{ id: 'ep', name: 'pipe-op', startTime: 0, duration: 10 }],
            },
          ],
        },
      ],
      minTime: 0,
      maxTime: 10,
    };
    const swimComm = {
      processes: [
        {
          id: 'p',
          name: 'P',
          threads: [
            {
              id: 't',
              name: 'comm-lane',
              events: [{ id: 'ec', name: 'comm-op', startTime: 0, duration: 50 }],
            },
          ],
        },
      ],
      minTime: 0,
      maxTime: 50,
    };
    const report = emptyReportViewModel();
    const spy = vi.spyOn(adapters, 'loadReportSource').mockReturnValue({
      swimlaneModel: swimPipe,
      reportModel: report,
      capabilities: [],
      timelineTraces: [
        { id: 'communication', embedName: 'Communication.json' },
        { id: 'pipeTrace', embedName: 'PipeTrace.json' },
      ],
      selectedTimelineTraceId: 'pipeTrace',
      timelineTraceModels: {
        communication: swimComm,
        pipeTrace: swimPipe,
      },
    });

    try {
      const wrapper = mount(ProfilingReport, {
        props: { source: new ArrayBuffer(8) },
      });
      await flushPromises();
      expect(wrapper.find('[data-testid="timeline-trace-selector"]').exists()).toBe(true);
      const toolbar = () => wrapper.findComponent(ReportToolbar);
      expect(toolbar().props('selectedTimelineTraceId')).toBe('pipeTrace');
      expect(
        (wrapper.findComponent(TimelineView).props('displaySwim') as typeof swimPipe).processes[0]
          ?.threads[0]?.name,
      ).toBe('pipe-lane');

      await wrapper.find('[data-testid="toggle-timeline-trace"]').trigger('click');
      await wrapper.find('[data-trace-id="pipeTrace"]').trigger('click');
      expect(toolbar().props('selectedTimelineTraceId')).toBe('pipeTrace');

      wrapper.vm.selectEventById('ep');
      expect(wrapper.vm.viewState.selectedEventId).toBe('ep');

      await wrapper.find('[data-testid="toggle-timeline-trace"]').trigger('click');
      await wrapper.find('[data-trace-id="communication"]').trigger('click');
      expect(toolbar().props('selectedTimelineTraceId')).toBe('communication');
      expect(
        (wrapper.findComponent(TimelineView).props('displaySwim') as typeof swimComm).processes[0]
          ?.threads[0]?.name,
      ).toBe('comm-lane');
      expect(wrapper.vm.viewState.startTime).toBe(0);
      expect(wrapper.vm.viewState.endTime).toBe(swimComm.maxTime);
      expect(wrapper.vm.viewState.selectedEventId).toBeNull();
      expect(spy).toHaveBeenCalledTimes(1);

      await wrapper.setProps({ source: undefined });
      await flushPromises();
      expect(wrapper.find('[data-testid="timeline-trace-selector"]').exists()).toBe(false);
      expect(wrapper.findComponent(TimelineView).exists()).toBe(false);
    } finally {
      spy.mockRestore();
    }
  });

  /** Two packs share one stamped row list, like loadReportSource's flattened rows. */
  async function mountMultiPackOverview() {
    const { vi } = await import('vitest');
    const adapters = await import('../../adapters');
    const swim = { processes: [], minTime: 0, maxTime: 1 };
    const operatorRows = [
      {
        opName: 'alpha-op',
        opType: 'vector',
        taskDurationUs: 1,
        blockDim: 1,
        gridSize: 1,
        blockSize: 1,
        sourceOperatorId: 'a.npu.rep',
      },
      {
        opName: 'beta-op',
        opType: 'vector',
        taskDurationUs: 2,
        blockDim: 1,
        gridSize: 1,
        blockSize: 1,
        sourceOperatorId: 'b.npu.rep',
      },
    ];
    const reportA = {
      ...emptyReportViewModel(),
      summary: { opName: 'alpha-op', taskDurationUs: 1 },
      operatorRows,
    };
    const reportB = {
      ...emptyReportViewModel(),
      summary: { opName: 'beta-op', taskDurationUs: 2 },
      operatorRows,
    };
    const spy = vi.spyOn(adapters, 'loadReportSource').mockReturnValue({
      swimlaneModel: swim,
      reportModel: reportA,
      capabilities: [],
      operators: [
        { id: 'a.npu.rep', label: 'alpha-op' },
        { id: 'b.npu.rep', label: 'beta-op' },
      ],
      operatorReports: {
        'a.npu.rep': { swimlaneModel: swim, reportModel: reportA, capabilities: [] },
        'b.npu.rep': { swimlaneModel: swim, reportModel: reportB, capabilities: [] },
      },
      selectedOperatorId: 'a.npu.rep',
    });
    const wrapper = mount(ProfilingReport, { props: { source: new ArrayBuffer(8) } });
    await flushPromises();
    await wrapper.find('[data-testid="tab-overview"]').trigger('click');
    await nextTick();
    return { wrapper, spy };
  }

  it('PR-ROOT-005e: Overview row selection and OP selector stay in sync', async () => {
    const { wrapper, spy } = await mountMultiPackOverview();
    try {
      const overview = wrapper.find('[data-testid="operator-overview"]');
      const rows = overview.findAll('tbody tr');
      expect(rows).toHaveLength(2);

      await rows[1].trigger('click');
      await nextTick();
      expect(wrapper.vm.selectedOperatorId).toBe('b.npu.rep');
      await wrapper.find('[data-testid="op-selector"] button').trigger('click');
      expect(wrapper.findAll('[data-testid="op-item"]')[1].attributes('aria-selected')).toBe('true');

      await wrapper.findAll('[data-testid="op-item"]')[0].trigger('click');
      await nextTick();
      expect(wrapper.vm.selectedOperatorId).toBe('a.npu.rep');
      const selected = wrapper.findAll('[data-testid="operator-overview"] tbody tr[aria-selected="true"]');
      expect(selected).toHaveLength(1);
      expect(selected[0].text()).toContain('alpha-op');
    } finally {
      spy.mockRestore();
    }
  });

  it('PR-ROOT-005f: clicking the Overview operator name switches to the timeline tab', async () => {
    const { wrapper, spy } = await mountMultiPackOverview();
    try {
      await wrapper.find('button.pr-operator-overview__op-name').trigger('click');
      await nextTick();
      expect(wrapper.find('[data-testid="tab-timeline"]').classes()).toContain(
        'pr-tabs__tab--active',
      );
      expect(wrapper.find('[data-testid="operator-overview"]').exists()).toBe(false);
    } finally {
      spy.mockRestore();
    }
  });

  it("PR-ROOT-005g: OP selector label equals the selected pack's first Overview OpName", async () => {
    const { wrapper, spy } = await mountMultiPackOverview();
    try {
      const label = () => wrapper.find('[data-testid="op-selector-label"]').text();
      const opNames = () =>
        wrapper.findAll('button.pr-operator-overview__op-name').map((button) => button.text());

      expect(label()).toBe('alpha-op');
      expect(label()).toBe(opNames()[0]);

      await wrapper.find('[data-testid="op-selector"] button').trigger('click');
      await wrapper.findAll('[data-testid="op-item"]')[1].trigger('click');
      await nextTick();
      expect(wrapper.vm.selectedOperatorId).toBe('b.npu.rep');
      expect(label()).toBe('beta-op');
      expect(label()).toBe(opNames()[1]);
    } finally {
      spy.mockRestore();
    }
  });

  it('PR-ROOT-008: cannbot buttons emit cannbot-request with scoped payload; cooldown swallows repeat clicks', async () => {
    vi.useFakeTimers();
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

    // 防抖：冷却窗口内的再次点击被吞掉，误操作连点不会打开多次对话。
    await wrapper.get('[data-testid="cannbot-compute"]').trigger('click');
    expect(wrapper.emitted('cannbot-request')).toHaveLength(1);
    // 冷却锁跨图标共享：换一个图标点击，同样被吞掉（1s 内不会打开第二场对话）。
    await wrapper.get('[data-testid="cannbot-summary"]').trigger('click');
    expect(wrapper.emitted('cannbot-request')).toHaveLength(1);

    vi.advanceTimersByTime(1000);
    await wrapper.get('[data-testid="cannbot-summary"]').trigger('click');
    const all = wrapper.emitted('cannbot-request')!;
    expect(all).toHaveLength(2);
    const summaryPayload = all[1]![0] as CannbotPayload;
    expect(summaryPayload.scope).toBe('summary');
    expect((summaryPayload.data.summary as { opName?: string }).opName).toBe('matmul_v3');

    wrapper.unmount();
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

  it('PR-ROOT-025: the heat panel is the 全屏 overlay’s right column, capability-gated', async () => {
    const wrapper = mount(ProfilingReport, {
      props: {
        title: 'topo-fs-heat',
        swimlaneModel: { processes: [], minTime: 0, maxTime: 1000 },
        reportModel: markRaw(heatmapReport()),
        capabilities: ['memoryHeatmap'],
      },
    });
    await wrapper.get('[data-testid="topology-fullscreen"]').trigger('click');
    const overlay = wrapper.get('[data-testid="topology-fullscreen-overlay"]');
    const body = overlay.get('.pr-topo-fs__body');
    expect(body.classes()).toContain('pr-topo-fs__body--split');
    const diagram = body.get('.pr-topo-fs__diagram');
    const heat = body.get('[data-testid="memory-heatmap-panel"]');
    expect(diagram.find('[data-testid="memory-topology-panel"]').exists()).toBe(true);
    // Right column, and it is the heat carrier — not the topology one.
    expect(heat.classes()).toContain('pr-topo-fs__heat');
    expect(heat.find('[data-testid="heat-tab-ub"]').exists()).toBe(true);
    expect(heat.find('[data-testid="memory-topology-panel"]').exists()).toBe(false);

    // Without the capability the overlay is the diagram alone: no panel, no reserved column.
    const plain = mount(ProfilingReport, {
      props: {
        title: 'topo-fs-plain',
        swimlaneModel: { processes: [], minTime: 0, maxTime: 1000 },
        reportModel: markRaw(heatmapReport()),
      },
    });
    await plain.get('[data-testid="topology-fullscreen"]').trigger('click');
    const plainOverlay = plain.get('[data-testid="topology-fullscreen-overlay"]');
    expect(plainOverlay.find('[data-testid="memory-heatmap-panel"]').exists()).toBe(false);
    expect(plainOverlay.get('.pr-topo-fs__body').classes()).not.toContain(
      'pr-topo-fs__body--split',
    );
    wrapper.unmount();
    plain.unmount();
  });

  it('PR-ROOT-026: one selection — 全屏 defaults, tabs and diagram both move it', async () => {
    const wrapper = mount(ProfilingReport, {
      props: {
        title: 'topo-fs-select',
        swimlaneModel: { processes: [], minTime: 0, maxTime: 1000 },
        reportModel: markRaw(heatmapReport()),
        capabilities: ['memoryHeatmap'],
      },
    });
    // 默认选中一个 memory: the model's first unit, mirrored on the diagram.
    await wrapper.get('[data-testid="topology-fullscreen"]').trigger('click');
    let overlay = wrapper.get('[data-testid="topology-fullscreen-overlay"]');
    expect(overlay.get('[data-testid="heat-tab-ub"]').attributes('aria-selected')).toBe('true');
    expect(overlay.get('[data-testid="memory-unit-ub"]').classes()).toContain('pr-topo__unit--on');

    // A panel tab moves the diagram's highlight too, and blanks a unit with no source.
    await overlay.get('[data-testid="heat-tab-l0c"]').trigger('click');
    overlay = wrapper.get('[data-testid="topology-fullscreen-overlay"]');
    expect(overlay.get('[data-testid="memory-unit-l0c"]').classes()).toContain('pr-topo__unit--on');
    expect(overlay.get('[data-testid="memory-unit-ub"]').classes()).not.toContain(
      'pr-topo__unit--on',
    );
    expect(overlay.find('[data-testid="heat-empty"]').exists()).toBe(true);

    // Back to the default for the next assertion, then close and re-enter per session.
    await overlay.get('[data-testid="heat-tab-ub"]').trigger('click');
    await wrapper.get('[data-testid="topology-fullscreen-back"]').trigger('click');
    expect(wrapper.find('[data-testid="topology-fullscreen-overlay"]').exists()).toBe(false);

    // 点击一个 memory 进来则直接对应显示相应的内容 — from the *stacked* diagram.
    await wrapper.findAll('[data-testid="memory-unit-l1"]')[0].trigger('click');
    overlay = wrapper.get('[data-testid="topology-fullscreen-overlay"]');
    expect(overlay.get('[data-testid="heat-tab-l1"]').attributes('aria-selected')).toBe('true');
    expect(overlay.get('[data-testid="memory-unit-l1"]').classes()).toContain('pr-topo__unit--on');
    wrapper.unmount();
  });

  it('PR-ROOT-027: the heat column leaves the overlay’s diagram geometry alone', async () => {
    const src = (await import('./ProfilingReport.vue?raw')).default as string;
    // Overlay ground is literal `#1a1a1a` (dark-only chrome, not `--pr-bg-aside`).
    expect(src).toMatch(/\.pr-topo-fs\s*\{[^}]*background:\s*#1a1a1a/s);
    expect(src).not.toMatch(/\.pr-topo-fs\s*\{[^}]*background:\s*var\(--pr-bg-aside/s);
    expect(src).toMatch(/\.pr-topo-fs__heat\s*\{[^}]*flex:\s*0\s+0\s+400px/s);
    expect(src).toMatch(/\.pr-topo-fs__body--split\s*\{[^}]*gap:\s*16px/s);
    expect(src).toMatch(
      /\.pr-topo-fs__body\s+:deep\(\.pr-topo\)\s*\{[^}]*background:\s*transparent/s,
    );
    // Zoom pill is `#262626` / `8px` on the overlay ground (1030 sketch), not transparent.
    expect(src).toMatch(
      /\.pr-topo-fs__body\s+:deep\(\.pr-topo__bar\)\s*\{[^}]*background:\s*#262626/s,
    );
    expect(src).toMatch(
      /\.pr-topo-fs__body\s+:deep\(\.pr-topo__bar\)\s*\{[^}]*border-radius:\s*8px/s,
    );
    expect(src).toMatch(/\.pr-topo-fs__body\s+:deep\(\.pr-topo\)\s*\{[^}]*padding:\s*0/s);

    const wrapper = mount(ProfilingReport, {
      props: {
        title: 'topo-fs-geom',
        swimlaneModel: { processes: [], minTime: 0, maxTime: 1000 },
        reportModel: markRaw({ ...archDiagramReport(), memoryHeatmap: heatmapReport().memoryHeatmap }),
        capabilities: ['archDiagram', 'memoryHeatmap'],
      },
    });
    await wrapper.get('[data-testid="topology-fullscreen"]').trigger('click');
    const overlay = wrapper.get('[data-testid="topology-fullscreen-overlay"]');
    const diagram = overlay.get('.pr-topo-fs__diagram');
    // The Metric switcher stays over the diagram, never over the heat column.
    expect(diagram.find('[data-testid="topology-fullscreen-metric-switcher"]').exists()).toBe(true);
    // Zoom bar and fit frame are still the diagram's own.
    expect(diagram.find('[data-testid="topology-zoom-in"]').exists()).toBe(true);
    expect(diagram.find('.pr-topo__frame').exists()).toBe(true);
    expect(overlay.get('[data-testid="memory-heatmap-panel"]').find('.pr-topo__frame').exists()).toBe(
      false,
    );
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
  }, 20_000);

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

  it('PR-ROOT-024: export-html stitches source; hidden without source or when disallowed', async () => {
    const { flushPromises } = await import('@vue/test-utils');
    const noSource = mount(ProfilingReport, {
      props: { swimlaneModel: depsModel(), reportModel: emptyReportViewModel() },
    });
    expect(noSource.find('[data-testid="export-html"]').exists()).toBe(false);
    noSource.unmount();

    const { loadNpuRepBuffer } = await import('../../../tests/helpers/fixtures');
    const deniedDefault = mount(ProfilingReport, {
      props: { source: loadNpuRepBuffer() },
    });
    expect(deniedDefault.find('[data-testid="export-html"]').exists()).toBe(false);
    deniedDefault.unmount();

    const denied = mount(ProfilingReport, {
      props: { source: loadNpuRepBuffer(), allowHtmlExport: false },
    });
    expect(denied.find('[data-testid="export-html"]').exists()).toBe(false);
    denied.unmount();

    const template = `<!doctype html><html lang="zh-CN"><head><title>x</title></head><body>
<!-- __NPU_REP_EMBED_START__ -->
<script>window.__NPU_REP_B64__='__HTML_EXPORT_B64__';window.__NPU_REP_NAME__='__HTML_EXPORT_NAME__';window.__NPU_REP_LOCALE__='__HTML_EXPORT_LOCALE__';</script>
<!-- __NPU_REP_EMBED_END__ --></body></html>`;
    let resolveFetch: (value: { ok: boolean; text: () => Promise<string> }) => void = () => undefined;
    vi.stubGlobal(
      'fetch',
      vi.fn(
        () =>
          new Promise((resolve) => {
            resolveFetch = resolve;
          }),
      ),
    );
    let stitched = '';
    const OrigBlob = globalThis.Blob;
    vi.stubGlobal(
      'Blob',
      class extends OrigBlob {
        constructor(parts?: BlobPart[], options?: BlobPropertyBag) {
          super(parts, options);
          stitched = String(parts?.[0] ?? '');
        }
      },
    );
    vi.stubGlobal('URL', {
      createObjectURL: () => 'blob:export',
      revokeObjectURL: () => undefined,
    });
    const wrapper = mount(ProfilingReport, {
      attachTo: document.body,
      props: {
        source: loadNpuRepBuffer(),
        allowHtmlExport: true,
        locale: 'en',
        reportMeta: { name: 'op.npu-rep', id: 'op', path: 'op', collectedAt: 't' },
      },
    });
    expect(wrapper.find('[data-testid="export-html"]').exists()).toBe(true);
    const realCreate = document.createElement.bind(document);
    const click = vi.fn();
    vi.spyOn(document, 'createElement').mockImplementation((tag, opts) => {
      const el = realCreate(tag, opts as ElementCreationOptions);
      if (tag === 'a') el.click = click;
      return el;
    });
    await wrapper.find('[data-testid="export-html"]').trigger('click');
    await flushPromises();
    expect(wrapper.find('[data-testid="html-export-dialog"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="html-export-progress"]').exists()).toBe(true);
    resolveFetch({ ok: true, text: async () => template });
    await flushPromises();
    expect(click).toHaveBeenCalled();
    expect(wrapper.emitted('export-html')?.[0]).toEqual([{ fileName: 'op.html' }]);
    expect(wrapper.emitted('error')).toBeUndefined();
    expect(stitched).toContain("window.__NPU_REP_LOCALE__='en'");
    expect(stitched).toMatch(/<html[^>]*\blang="en"/);
    expect(wrapper.find('[data-testid="html-export-dialog"]').exists()).toBe(false);
    wrapper.unmount();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('PR-ROOT-024: export dialog Cancel aborts before download', async () => {
    const { flushPromises } = await import('@vue/test-utils');
    const { loadNpuRepBuffer } = await import('../../../tests/helpers/fixtures');
    vi.stubGlobal(
      'fetch',
      vi.fn((_url: string, init?: RequestInit) => {
        return new Promise((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => {
            const err = new Error('Aborted');
            err.name = 'AbortError';
            reject(err);
          });
        });
      }),
    );
    const wrapper = mount(ProfilingReport, {
      attachTo: document.body,
      props: { source: loadNpuRepBuffer(), allowHtmlExport: true },
    });
    await wrapper.find('[data-testid="export-html"]').trigger('click');
    await flushPromises();
    expect(wrapper.find('[data-testid="html-export-dialog"]').exists()).toBe(true);
    await wrapper.find('[data-testid="html-export-cancel"]').trigger('click');
    await flushPromises();
    expect(wrapper.find('[data-testid="html-export-dialog"]').exists()).toBe(false);
    expect(wrapper.emitted('export-html')).toBeUndefined();
    expect(wrapper.emitted('error')).toBeUndefined();
    wrapper.unmount();
    vi.unstubAllGlobals();
  });

  it('PR-ROOT-024: export fetch failure stays in the dialog and does not emit error', async () => {
    const { flushPromises } = await import('@vue/test-utils');
    const { loadNpuRepBuffer } = await import('../../../tests/helpers/fixtures');
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({ ok: false, status: 404, text: async () => '' })),
    );
    const wrapper = mount(ProfilingReport, {
      attachTo: document.body,
      props: { source: loadNpuRepBuffer(), allowHtmlExport: true },
    });
    await wrapper.find('[data-testid="export-html"]').trigger('click');
    await flushPromises();
    expect(wrapper.find('[data-testid="html-export-dialog"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="html-export-error"]').text()).toMatch(/404/);
    expect(wrapper.emitted('error')).toBeUndefined();
    expect(wrapper.emitted('export-html')).toBeUndefined();
    wrapper.unmount();
    vi.unstubAllGlobals();
  });

  it('PR-ROOT-028: Source tab v-if swap keeps viewState time window (UI-37)', async () => {
    const hidden = mount(ProfilingReport, {
      props: {
        title: 'source-tab',
        swimlaneModel: depsModel(),
        reportModel: {
          ...emptyReportViewModel(),
          sourceCorrelation: mockSourceCorrelation(),
        },
        capabilities: ['sourceTab'],
      },
    });
    expect(hidden.find('[data-testid="tab-source"]').exists()).toBe(false);
    hidden.unmount();

    const reportModel = {
      ...emptyReportViewModel(),
      sourceCorrelation: { ...mockSourceCorrelation(), mock: false },
    };
    const wrapper = mount(ProfilingReport, {
      props: {
        title: 'source-tab',
        swimlaneModel: depsModel(),
        reportModel,
        capabilities: ['sourceTab'],
      },
    });
    wrapper.vm.viewState = {
      ...wrapper.vm.viewState,
      startTime: 120,
      endTime: 480,
    };

    expect(wrapper.find('[data-testid="tab-source"]').attributes('disabled')).toBeUndefined();
    await wrapper.find('[data-testid="tab-source"]').trigger('click');
    await nextTick();
    expect(wrapper.find('[data-testid="source-view"]').exists()).toBe(true);
    expect(wrapper.findComponent(TimelineView).exists()).toBe(false);

    await wrapper.find('[data-testid="tab-timeline"]').trigger('click');
    await nextTick();
    expect(wrapper.find('[data-testid="source-view"]').exists()).toBe(false);
    expect(wrapper.findComponent(TimelineView).exists()).toBe(true);
    expect(wrapper.vm.viewState.startTime).toBe(120);
    expect(wrapper.vm.viewState.endTime).toBe(480);
    wrapper.unmount();
  });

  it('PR-ROOT-035: 概览 tab is first; 时间线 stays default; 概览 mounts the overview', async () => {
    const wrapper = mount(ProfilingReport, {
      props: {
        title: 'overview-tab',
        swimlaneModel: depsModel(),
        reportModel: {
          ...emptyReportViewModel(),
          operatorRows: [
            {
              opName: 'gather_2d_custom',
              opType: 'vector',
              taskDurationUs: 0.73,
              blockDim: 40,
              gridSize: 85.25,
              blockSize: 32,
            },
            {
              opName: 'matmul_leakyrelu',
              opType: 'cube',
              taskDurationUs: 12.5,
              blockDim: 24,
              gridSize: 100,
              blockSize: 16,
            },
          ],
          pipeOccupancy: [{ id: 'cube', label: 'Cube', ratio: 0.2, colorKey: 'cube', side: 'cube' }],
        },
      },
    });

    const tabs = wrapper.findAll('.pr-tabs__tab');
    expect(tabs[0].attributes('data-testid')).toBe('tab-overview');
    expect(wrapper.find('[data-testid="tab-timeline"]').classes()).toContain(
      'pr-tabs__tab--active',
    );
    expect(wrapper.find('[data-testid="tab-overview"]').classes()).not.toContain(
      'pr-tabs__tab--active',
    );
    expect(wrapper.find('[data-testid="operator-overview"]').exists()).toBe(false);
    expect(wrapper.find('[data-testid="tab-detail"]').exists()).toBe(false);
    expect(wrapper.find('[data-testid="tab-cache"]').exists()).toBe(false);

    await wrapper.find('[data-testid="tab-overview"]').trigger('click');
    await nextTick();
    expect(wrapper.findComponent(TimelineView).exists()).toBe(false);
    const overview = wrapper.find('[data-testid="operator-overview"]');
    expect(overview.exists()).toBe(true);
    expect(overview.text()).toContain('gather_2d_custom');
    expect(overview.text()).toContain('低利用率');
    wrapper.unmount();
  });

  it('PR-ROOT-035: 概览 tab is hidden for models without operator rows', async () => {
    const wrapper = mount(ProfilingReport, {
      props: { swimlaneModel: depsModel(), reportModel: emptyReportViewModel() },
    });

    expect(wrapper.find('[data-testid="tab-overview"]').exists()).toBe(false);
    expect(wrapper.find('[data-testid="tab-timeline"]').exists()).toBe(true);
    wrapper.unmount();
  });

  it('PR-ROOT-035: a single operator row still renders the 概览 tab first and mounts the overview', async () => {
    const wrapper = mount(ProfilingReport, {
      props: {
        swimlaneModel: depsModel(),
        reportModel: {
          ...emptyReportViewModel(),
          operatorRows: [{ opName: 'gather_2d_custom', opType: 'vector', taskDurationUs: 0.73 }],
        },
      },
    });

    expect(wrapper.find('[data-testid="tab-overview"]').exists()).toBe(true);
    expect(wrapper.findAll('.pr-tabs__tab')[0].attributes('data-testid')).toBe('tab-overview');

    await wrapper.find('[data-testid="tab-overview"]').trigger('click');
    await nextTick();
    expect(wrapper.find('[data-testid="operator-overview"]').exists()).toBe(true);
    expect(wrapper.findComponent(TimelineView).exists()).toBe(false);
    wrapper.unmount();
  });

  it('PR-ROOT-038: a failed load while 概览 is active keeps the tab strip on 时间线', async () => {
    const spy = vi.spyOn(adapters, 'loadReportSource').mockImplementation(() => {
      throw new Error('corrupt bytes');
    });
    try {
      const wrapper = mount(ProfilingReport, {
        props: {
          swimlaneModel: depsModel(),
          reportModel: {
            ...emptyReportViewModel(),
            operatorRows: [
              { opName: 'gather_2d_custom', opType: 'vector', taskDurationUs: 0.73 },
              { opName: 'matmul_leakyrelu', opType: 'cube', taskDurationUs: 12.5 },
            ],
          },
        },
      });
      await wrapper.find('[data-testid="tab-overview"]').trigger('click');
      await nextTick();
      expect(wrapper.find('[data-testid="operator-overview"]').exists()).toBe(true);

      await wrapper.setProps({ source: new Uint8Array([1, 2, 3]) });
      await flushPromises();
      await nextTick();

      expect(wrapper.find('[data-testid="load-error"]').exists()).toBe(true);
      expect(wrapper.find('[data-testid="report-tabs"]').exists()).toBe(true);
      expect(wrapper.find('[data-testid="tab-timeline"]').classes()).toContain(
        'pr-tabs__tab--active',
      );
      wrapper.unmount();
    } finally {
      spy.mockRestore();
    }
  });

  it('PR-ROOT-039: W/S/A/D and Shift+P ignore the hidden timeline while 概览 is active', async () => {
    const wrapper = mount(ProfilingReport, {
      attachTo: document.body,
      props: {
        swimlaneModel: depsModel(),
        reportModel: {
          ...emptyReportViewModel(),
          operatorRows: [
            { opName: 'gather_2d_custom', opType: 'vector', taskDurationUs: 0.73 },
            { opName: 'matmul_leakyrelu', opType: 'cube', taskDurationUs: 12.5 },
          ],
        },
      },
    });

    wrapper.findComponent(TimelineView).vm.$emit('hover-lane', 't-0');
    await nextTick();
    await wrapper.find('[data-testid="tab-overview"]').trigger('click');
    await nextTick();
    const before = { ...wrapper.vm.viewState };

    for (const key of ['w', 'a', 's', 'd']) {
      window.dispatchEvent(new KeyboardEvent('keydown', { key }));
    }
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'P', shiftKey: true }));
    await nextTick();

    expect(wrapper.vm.viewState.startTime).toBe(before.startTime);
    expect(wrapper.vm.viewState.endTime).toBe(before.endTime);
    expect(wrapper.vm.viewState.pinnedLaneIds).toEqual(before.pinnedLaneIds);
    wrapper.unmount();
  });

  it('PR-ROOT-037: Overview and stats aside share the Optimize action', async () => {
    const wrapper = mount(ProfilingReport, {
      props: {
        title: 'overview-optimize',
        locale: 'en',
        reportMeta: { path: '/reports/overview.npu-rep' },
        swimlaneModel: depsModel(),
        reportModel: {
          ...emptyReportViewModel(),
          summary: { opName: 'gather_2d_custom', taskDurationUs: 0.73 },
          operatorRows: [
            { opName: 'gather_2d_custom', opType: 'vector', taskDurationUs: 0.73 },
            { opName: 'matmul_leakyrelu', opType: 'cube', taskDurationUs: 12.5 },
          ],
        },
      },
    });
    vi.useFakeTimers({ toFake: ['Date'] });
    try {
      await wrapper.get('[data-testid="tab-overview"]').trigger('click');
      await wrapper.findAll('tbody tr')[1].trigger('click');
      const overviewButton = wrapper.get('[data-testid="overview-optimize-trigger"]');
      await overviewButton.trigger('click');
      expect(wrapper.emitted('optimize')).toBeUndefined();
      expect(wrapper.emitted('perform-optimization')).toEqual([
        [{ report_path: '/reports/overview.npu-rep', op_name: 'matmul_leakyrelu' }],
      ]);

      vi.advanceTimersByTime(500);
      await overviewButton.trigger('click');
      expect(wrapper.emitted('optimize')).toBeUndefined();
      expect(wrapper.emitted('perform-optimization')).toHaveLength(1);

      await wrapper.get('[data-testid="tab-timeline"]').trigger('click');
      const statsButton = wrapper.get('[data-testid="perform-optimization-trigger"]');
      vi.advanceTimersByTime(499);
      await statsButton.trigger('click');
      expect(wrapper.emitted('perform-optimization')).toHaveLength(1);

      vi.advanceTimersByTime(1);
      await statsButton.trigger('click');
      expect(wrapper.emitted('perform-optimization')?.[1]).toEqual([
        { report_path: '/reports/overview.npu-rep', op_name: 'gather_2d_custom' },
      ]);
    } finally {
      vi.useRealTimers();
      wrapper.unmount();
    }
  });

  it('PR-ROOT-029: a Parameter frame opens Source at its line, or line 1', async () => {
    const correlation = mockSourceCorrelation();
    const file = correlation.files[0]!;
    const bare = '/home/chenning/asc-devkit/examples/gather_2d/gather_2d.asc';
    const model = depsModel();
    model.processes[0]!.threads[0]!.events[0]!.args = { Code: [bare, `${bare}:39`] };
    const wrapper = mount(ProfilingReport, {
      props: {
        title: 'source-link',
        swimlaneModel: model,
        reportModel: {
          ...emptyReportViewModel(),
          sourceCorrelation: {
            ...correlation,
            mock: false,
            files: [{ ...file, id: 'gather_2d.asc', path: 'gather_2d.asc' }],
          },
        },
        capabilities: ['sourceTab'],
      },
    });
    (wrapper.vm as unknown as { selectEventById: (id: string) => void }).selectEventById('a');
    await nextTick();

    const links = wrapper.findAll('[data-testid="source-frame-link"]');
    expect(links).toHaveLength(2);
    await links[0]!.trigger('click');
    await flushPromises();
    expect(wrapper.find('[data-testid="source-view"]').exists()).toBe(true);
    expect(
      wrapper.get('[data-testid="source-pane-source"] tr.pr-src-metrics__row--current').attributes('data-line'),
    ).toBe('1');

    await wrapper.find('[data-testid="tab-timeline"]').trigger('click');
    await nextTick();
    await wrapper.findAll('[data-testid="source-frame-link"]')[1]!.trigger('click');
    await flushPromises();
    expect(
      wrapper.get('[data-testid="source-pane-source"] tr.pr-src-metrics__row--current').attributes('data-line'),
    ).toBe('39');
    wrapper.unmount();
  });

  it('PR-ROOT-029: operator switch clears the frame caret', async () => {
    const { vi } = await import('vitest');
    const adapters = await import('../../adapters');
    const correlation = mockSourceCorrelation();
    const file = correlation.files[0]!;
    const linked = {
      ...correlation,
      mock: false as const,
      files: [{ ...file, id: 'gather_2d.asc', path: 'gather_2d.asc' }],
    };
    const swimA = depsModel();
    swimA.processes[0]!.threads[0]!.events[0]!.args = {
      Code: ['/tmp/gather_2d.asc:39'],
    };
    const swimB = depsModel();
    swimB.maxTime = 50;
    const reportA = { ...emptyReportViewModel(), sourceCorrelation: linked };
    const reportB = {
      ...emptyReportViewModel(),
      // New model, same file object: SourceView reapplies focus, the editor
      // does not reload the document.
      sourceCorrelation: { ...linked },
    };
    const spy = vi.spyOn(adapters, 'loadReportSource').mockReturnValue({
      swimlaneModel: swimA,
      reportModel: reportA,
      capabilities: ['sourceTab'],
      operators: [
        { id: 'a.npu.rep', label: 'a' },
        { id: 'b.npu.rep', label: 'b' },
      ],
      operatorReports: {
        'a.npu.rep': { swimlaneModel: swimA, reportModel: reportA, capabilities: ['sourceTab'] },
        'b.npu.rep': { swimlaneModel: swimB, reportModel: reportB, capabilities: ['sourceTab'] },
      },
      selectedOperatorId: 'a.npu.rep',
    });

    try {
      const wrapper = mount(ProfilingReport, {
        props: { source: new ArrayBuffer(8) },
      });
      await flushPromises();
      (wrapper.vm as unknown as { selectEventById: (id: string) => void }).selectEventById('a');
      await nextTick();
      await wrapper.get('[data-testid="source-frame-link"]').trigger('click');
      await flushPromises();
      expect(
        wrapper.get('[data-testid="source-pane-source"] tr.pr-src-metrics__row--current').attributes('data-line'),
      ).toBe('39');

      await wrapper.find('[data-testid="op-selector"] button').trigger('click');
      await wrapper.findAll('[data-testid="op-item"]')[1]!.trigger('click');
      await flushPromises();
      expect(wrapper.find('[data-testid="source-view"]').exists()).toBe(true);
      expect(
        wrapper.find('[data-testid="source-pane-source"] tr.pr-src-metrics__row--current').exists(),
      ).toBe(false);
      wrapper.unmount();
    } finally {
      spy.mockRestore();
    }
  });

  it('PR-ROOT-030: resolveSourceFile fills missing Ascend C after first paint', async () => {
    const base = mockSourceCorrelation();
    const missingPath = '/home/build/gather_2d.asc';
    const withMissing = {
      ...base,
      mock: false as const,
      files: [
        {
          ...base.files[0]!,
          id: 'gather_2d.asc',
          path: missingPath,
          text: `${MISSING_SOURCE_EMBED_PREFIX}${missingPath}\n`,
        },
      ],
    };
    let releaseResolve!: (text: string) => void;
    const resolveGate = new Promise<string>((resolve) => {
      releaseResolve = resolve;
    });
    const resolveSourceFile = vi.fn(async (req: { fileName: string; basename: string }) => {
      expect(req).toEqual({ fileName: missingPath, basename: 'gather_2d.asc' });
      return resolveGate;
    });
    const wrapper = mount(ProfilingReport, {
      props: {
        title: 'resolve-source',
        swimlaneModel: depsModel(),
        reportModel: {
          ...topologyReport(),
          sourceCorrelation: withMissing,
        },
        capabilities: ['sourceTab'],
        resolveSourceFile,
      },
    });
    await nextTick();
    expect(resolveSourceFile).toHaveBeenCalledTimes(1);
    // Overlay must not close topology 全屏 when resolve later patches sourceCorrelation.
    await wrapper.get('[data-testid="topology-fullscreen"]').trigger('click');
    expect(wrapper.find('[data-testid="topology-fullscreen-overlay"]').exists()).toBe(true);
    releaseResolve('extern "C" void gather_2d_custom() {}\n');
    await flushPromises();
    expect(wrapper.find('[data-testid="topology-fullscreen-overlay"]').exists()).toBe(true);
    await wrapper.find('[data-testid="tab-source"]').trigger('click');
    await nextTick();
    await flushPromises();
    const sourceView = wrapper.findComponent(SourceView);
    expect(sourceView.exists()).toBe(true);
    expect(sourceView.props('model').files[0].text).toContain('gather_2d_custom');
    expect(sourceView.props('model').files[0].text.startsWith(MISSING_SOURCE_EMBED_PREFIX)).toBe(
      false,
    );
    wrapper.unmount();

    const noCall = vi.fn(async () => 'unused');
    const embedded = mount(ProfilingReport, {
      props: {
        swimlaneModel: depsModel(),
        reportModel: {
          ...emptyReportViewModel(),
          sourceCorrelation: { ...mockSourceCorrelation(), mock: false },
        },
        capabilities: ['sourceTab'],
        resolveSourceFile: noCall,
      },
    });
    await flushPromises();
    expect(noCall).not.toHaveBeenCalled();
    embedded.unmount();

    const miss = vi.fn(async () => null);
    const kept = mount(ProfilingReport, {
      props: {
        swimlaneModel: depsModel(),
        reportModel: { ...emptyReportViewModel(), sourceCorrelation: withMissing },
        capabilities: ['sourceTab'],
        resolveSourceFile: miss,
      },
    });
    await flushPromises();
    expect(miss).toHaveBeenCalled();
    await kept.find('[data-testid="tab-source"]').trigger('click');
    await nextTick();
    expect(
      kept.findComponent(SourceView).props('model').files[0].text.startsWith(MISSING_SOURCE_EMBED_PREFIX),
    ).toBe(true);
    kept.unmount();

    // Late-bound hook (webview bridge after first paint) still fills placeholders.
    const late = vi.fn(async () => 'extern "C" void late_bound() {}\n');
    const deferred = mount(ProfilingReport, {
      props: {
        swimlaneModel: depsModel(),
        reportModel: { ...emptyReportViewModel(), sourceCorrelation: withMissing },
        capabilities: ['sourceTab'],
      },
    });
    await flushPromises();
    expect(late).not.toHaveBeenCalled();
    await deferred.setProps({ resolveSourceFile: late });
    await flushPromises();
    expect(late).toHaveBeenCalledTimes(1);
    // New function identity must not re-run (hosts often pass inline arrows).
    const again = vi.fn(async () => 'should not run');
    await deferred.setProps({ resolveSourceFile: again });
    await flushPromises();
    expect(again).not.toHaveBeenCalled();
    expect(late).toHaveBeenCalledTimes(1);
    await deferred.find('[data-testid="tab-source"]').trigger('click');
    await nextTick();
    expect(deferred.findComponent(SourceView).props('model').files[0].text).toContain('late_bound');
    deferred.unmount();
  });

  it('PR-ROOT-045: a checkbox toggle forwards the checked set as update:baselines', async () => {
    const wrapper = mount(ProfilingReport, {
      props: {
        swimlaneModel: depsModel(),
        reportModel: emptyReportViewModel(),
        baselines: [],
        pickBaselineFile: vi.fn().mockResolvedValue(null),
        recentBaselines: [
          { id: 'r1', name: 'R1', path: '/r1' },
          { id: 'r2', name: 'R2', path: '/r2' },
        ],
      },
    });
    await wrapper.get('[data-testid="toggle-baselines"]').trigger('click');
    // The picker panel teleports to body (PR-BASELINE-027), so its content is
    // read from the document, not the wrapper.
    const check = () =>
      document.querySelector<HTMLInputElement>('[data-testid="baseline-check"]')!;
    check().checked = true;
    check().dispatchEvent(new Event('change'));
    await nextTick();
    expect(wrapper.emitted('update:baselines')).toEqual([
      [[{ id: 'r1', name: 'R1', path: '/r1' }]],
    ]);
    // Unchecking removes it — the checked set IS the host-owned list.
    check().checked = false;
    check().dispatchEvent(new Event('change'));
    await nextTick();
    expect(wrapper.emitted('update:baselines')).toEqual([
      [[{ id: 'r1', name: 'R1', path: '/r1' }]],
      [[]],
    ]);
    wrapper.unmount();
  });

  it('PR-ROOT-046: Browse appends the picked report as a checked baseline', async () => {
    const pick = vi.fn().mockResolvedValue({ path: '/data/new.npu-rep', name: 'new-baseline' });
    const wrapper = mount(ProfilingReport, {
      props: {
        swimlaneModel: depsModel(),
        reportModel: emptyReportViewModel(),
        baselines: [],
        pickBaselineFile: pick,
        recentBaselines: [{ id: 'r1', name: 'R1', path: '/r1' }],
      },
    });
    await wrapper.get('[data-testid="toggle-baselines"]').trigger('click');
    (document.querySelector('[data-testid="baseline-browse"]') as HTMLElement).click();
    await nextTick();
    await flushPromises();
    const appended = wrapper.emitted('update:baselines')![0][0] as Baseline[];
    expect(appended).toHaveLength(1);
    expect(appended[0]).toMatchObject({ name: 'new-baseline', path: '/data/new.npu-rep' });
    expect(typeof appended[0].id).toBe('string');
    wrapper.unmount();
  });

  it('PR-ROOT-047: unchecking a baseline drops its comparison rows (host-owned invariant)', async () => {
    const wrapper = mount(ProfilingReport, {
      props: {
        swimlaneModel: depsModel(),
        reportModel: emptyReportViewModel(),
        baselines: [{ id: 'r1', name: 'R1', path: '/r1' }],
        baselineRows: [{ id: 'row1', baselineId: 'r1', operatorId: '' }],
        pickBaselineFile: vi.fn().mockResolvedValue(null),
        recentBaselines: [{ id: 'r1', name: 'R1', path: '/r1' }],
      },
    });
    await wrapper.get('[data-testid="toggle-baselines"]').trigger('click');
    // Teleported panel (PR-BASELINE-027): the checkbox lives in the document.
    const check = document.querySelector<HTMLInputElement>('[data-testid="baseline-check"]')!;
    check.checked = false;
    check.dispatchEvent(new Event('change'));
    await nextTick();
    expect(wrapper.emitted('update:baselines')).toEqual([[[]]]);
    // The host applies the emptied list back → the row is pruned.
    await wrapper.setProps({ baselines: [] });
    await nextTick();
    expect(wrapper.emitted('update:baselineRows')).toEqual([[[]]]);
    wrapper.unmount();
  });

  it('PR-ROOT-048: the aside receives the checked list + rows and row edits stay host-owned', async () => {
    const rows = [{ id: 'row1', baselineId: 'b1', operatorId: '' }];
    const wrapper = mount(ProfilingReport, {
      props: {
        swimlaneModel: depsModel(),
        reportModel: { ...emptyReportViewModel(), summary: { taskDurationUs: 1000 } },
        baselines: [
          { id: 'b1', name: 'OPPROF_A', path: '/a' },
          { id: 'b2', name: 'OPPROF_B', path: '/b' },
        ],
        baselineRows: rows,
        baselineReports: {},
        pickBaselineFile: vi.fn().mockResolvedValue(null),
      },
    });
    const aside = wrapper.findComponent({ name: 'StatsAside' });
    expect(aside.props('baselines')).toHaveLength(2);
    expect(aside.props('baselineRows')).toEqual(rows);
    const next = [{ id: 'row1', baselineId: 'b2', operatorId: '' }];
    aside.vm.$emit('update:baselineRows', next);
    await nextTick();
    expect(wrapper.emitted('update:baselineRows')).toEqual([[next]]);
    wrapper.unmount();
  });

  it('PR-ROOT-052: a checked set defaults one comparison row (first add + restored list)', async () => {
    const entry = { id: 'b1', name: 'OPPROF_A', path: '/a' };
    const wrapper = mount(ProfilingReport, {
      props: {
        swimlaneModel: depsModel(),
        reportModel: emptyReportViewModel(),
        baselines: [],
        baselineRows: [],
        pickBaselineFile: vi.fn().mockResolvedValue(null),
      },
    });
    // Empty → non-empty (the first add the host applies back) → the default row.
    await wrapper.setProps({ baselines: [entry] });
    await nextTick();
    const first = wrapper.emitted('update:baselineRows')?.[0]?.[0] as {
      baselineId: string;
      operatorId: string;
    }[];
    expect(first).toHaveLength(1);
    expect(first[0]).toMatchObject({ baselineId: 'b1', operatorId: '' });

    // An add onto a NON-empty list never adds another row.
    const emitted = wrapper.emitted('update:baselineRows')!.length;
    await wrapper.setProps({
      baselines: [entry, { id: 'b2', name: 'OPPROF_B', path: '/b' }],
      baselineRows: first as never,
    });
    await nextTick();
    expect(wrapper.emitted('update:baselineRows')!.length).toBe(emitted);
    wrapper.unmount();

    // A host-restored non-empty list with no rows mounts with the default row
    // (the design's 默认一个基线 — unlike the old single-selection contract).
    const restored = mount(ProfilingReport, {
      props: {
        swimlaneModel: depsModel(),
        reportModel: emptyReportViewModel(),
        baselines: [entry],
        baselineRows: [],
        pickBaselineFile: vi.fn().mockResolvedValue(null),
      },
    });
    await nextTick();
    const rows = restored.emitted('update:baselineRows')?.[0]?.[0] as { baselineId: string }[];
    expect(rows).toHaveLength(1);
    expect(rows[0].baselineId).toBe('b1');
    restored.unmount();
  });

  it('PR-ROOT-053: a pointerdown on the aside comparison bar closes the baselines popover', async () => {
    const wrapper = mount(ProfilingReport, {
      props: {
        swimlaneModel: depsModel(),
        reportModel: { ...emptyReportViewModel(), summary: { taskDurationUs: 1000 } },
        baselines: [{ id: 'b1', name: 'OPPROF_A', path: '/a' }],
        baselineRows: [{ id: 'row1', baselineId: 'b1', operatorId: '' }],
        pickBaselineFile: vi.fn().mockResolvedValue(null),
        recentBaselines: [{ id: 'b1', name: 'OPPROF_A', path: '/a' }],
      },
    });
    // Open the picker popover.
    await wrapper.get('[data-testid="toggle-baselines"]').trigger('click');
    // Teleported panel (PR-BASELINE-027): it lives in the document.
    expect(document.querySelector('[data-testid="baselines-popover"]')).not.toBeNull();
    // Press anywhere on the aside bar — the capture emit reaches the root,
    // which closes the popover through the toolbar's exposed close.
    const bar = wrapper.get('[data-testid="stats-baseline-bar"]');
    await bar.trigger('pointerdown');
    await nextTick();
    expect(document.querySelector('[data-testid="baselines-popover"]')).toBeNull();
    wrapper.unmount();
  });

  it('PR-ROOT-049: cached baseline packs paint in place; a row without its pack shows no comparison', async () => {
    const pack = (us: number): AdaptedReport => ({
      reportModel: { ...emptyReportViewModel(), summary: { taskDurationUs: us, opName: 'relu' } },
      swimlaneModel: null,
    });
    const wrapper = mount(ProfilingReport, {
      props: {
        swimlaneModel: depsModel(),
        reportModel: { ...emptyReportViewModel(), summary: { taskDurationUs: 1000 } },
        baselines: [
          { id: 'b1', name: 'OPPROF_A', path: '/a' },
          { id: 'b2', name: 'OPPROF_B', path: '/b' },
          { id: 'b9', name: 'OPPROF_C', path: '/c' },
        ],
        baselineRows: [{ id: 'row1', baselineId: 'b1', operatorId: '' }],
        baselineReports: { b1: { baselineId: 'b1', report: pack(900) } },
      },
    });
    await flushPromises();
    expect(wrapper.find('[data-testid="stats-duration-diff"]').exists()).toBe(true);

    // Switching the row to an ALREADY cached pack paints it in place.
    await wrapper.setProps({
      baselineRows: [{ id: 'row1', baselineId: 'b2', operatorId: '' }],
      baselineReports: {
        b1: { baselineId: 'b1', report: pack(900) },
        b2: { baselineId: 'b2', report: pack(700) },
      },
    });
    await nextTick();
    expect(wrapper.find('[data-testid="stats-duration-diff"]').exists()).toBe(true);
    expect(wrapper.get('[data-testid="stats-duration-diff"] .pr-diff__text').text()).toBe('0.30');

    // A row whose pack has not landed yet (still adapting) paints no
    // comparison — never another baseline's values.
    await wrapper.setProps({
      baselineRows: [{ id: 'row1', baselineId: 'b9', operatorId: '' }],
    });
    await nextTick();
    expect(wrapper.find('[data-testid="stats-duration-diff"]').exists()).toBe(false);

    // The pack landing brings the badge back in place, no remount of the aside.
    const aside = wrapper.findComponent({ name: 'StatsAside' });
    const asideEl = aside.element;
    await wrapper.setProps({
      baselineReports: {
        b1: { baselineId: 'b1', report: pack(900) },
        b2: { baselineId: 'b2', report: pack(700) },
        b9: { baselineId: 'b9', report: pack(500) },
      },
    });
    await nextTick();
    expect(wrapper.find('[data-testid="stats-duration-diff"]').exists()).toBe(true);
    expect(wrapper.get('[data-testid="stats-duration-diff"] .pr-diff__text').text()).toBe('0.50');
    expect(wrapper.findComponent({ name: 'StatsAside' }).element).toBe(asideEl);
    wrapper.unmount();
  });

  it('PR-ROOT-050: the baseline reports are a data-only side channel', async () => {
    const baselinePack: AdaptedReport = {
      reportModel: { ...emptyReportViewModel(), summary: { taskDurationUs: 900, opName: 'relu' } },
      swimlaneModel: null,
    };
    const base = {
      swimlaneModel: depsModel(),
      reportModel: { ...emptyReportViewModel(), summary: { taskDurationUs: 1000 } },
      baselines: [{ id: 'b1', name: 'OPPROF_A', path: '/a' }],
      baselineRows: [{ id: 'row1', baselineId: 'b1', operatorId: '' }],
      baselineReports: { b1: { baselineId: 'b1', report: baselinePack } },
    };
    const wrapper = mount(ProfilingReport, { props: base });
    await flushPromises();
    // The payload rides alongside the normal mount: one ready, no error.
    expect(wrapper.emitted('ready')).toHaveLength(1);
    expect(wrapper.emitted('error')).toBeUndefined();
    expect(wrapper.find('[data-testid="stats-aside"]').exists()).toBe(true);

    // Select an event so view state has something a reset would destroy.
    const vm = wrapper.vm as unknown as { viewState: { selectedEventId: string | null } };
    const only = [depsModel().processes[0]!.threads[0]!.events[0]!];
    wrapper.findComponent({ name: 'TimelineView' }).vm.$emit('multi-select', only);
    await nextTick();
    expect(vm.viewState.selectedEventId).toBe('a');
    expect(wrapper.find('[data-testid="detail-panel"]').exists()).toBe(true);
    const selects = wrapper.emitted('select')?.length ?? 0;

    // Swapping an unrelated cached pack must not re-load or reset.
    await wrapper.setProps({
      baselineReports: {
        b1: { baselineId: 'b1', report: baselinePack },
        b9: { baselineId: 'b9', report: baselinePack },
      },
    });
    await flushPromises();
    expect(wrapper.emitted('ready')).toHaveLength(1);
    expect(wrapper.emitted('error')).toBeUndefined();
    expect(wrapper.emitted('select')?.length ?? 0).toBe(selects);
    expect(vm.viewState.selectedEventId).toBe('a');
    expect(wrapper.find('[data-testid="detail-panel"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="stats-aside"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="stats-duration-diff"]').exists()).toBe(true);
    // Dropping the row's pack ends just the comparison chrome.
    await wrapper.setProps({ baselineReports: {} });
    await nextTick();
    expect(wrapper.find('[data-testid="stats-duration-diff"]').exists()).toBe(false);
    expect(wrapper.find('[data-testid="stats-aside"]').exists()).toBe(true);
    wrapper.unmount();
  });

  /** Panel stub for the 全屏 pass-through tests: the root's model/baseline
   *  hand-off is the contract there, not the SVG chrome. */
  const TopologyPanelStub = defineComponent({
    name: 'MemoryTopologyPanel',
    props: {
      model: { type: Object, default: null },
      baseline: { type: Object, default: null },
    },
    emits: ['open-details', 'open-fullscreen', 'open-memory-unit'],
    setup(_props, { emit }) {
      return () =>
        h('div', { 'data-testid': 'topology-panel-stub' }, [
          h(
            'button',
            {
              'data-testid': 'topology-panel-stub-fullscreen',
              onClick: () => emit('open-fullscreen'),
            },
            'fs',
          ),
        ]);
    },
  });

  it('PR-ROOT-051: topology 全屏 badges against the primary row pack, in place', async () => {
    const memoryTable = (value: string) => ({
      fileName: 'Memory.csv',
      headers: ['block_id', 'aiv_gm_to_ub_bw(GB/s)'],
      rows: [{ block_id: '0', 'aiv_gm_to_ub_bw(GB/s)': value }],
      blockIds: ['0'],
    });
    const topologyOf = (value: string): MemoryTopologyModel =>
      firstLabelledMemoryTopology([memoryTable(value)])!.model;
    const packOf = (topology: MemoryTopologyModel): AdaptedReport => ({
      reportModel: {
        ...emptyReportViewModel(),
        summary: { taskDurationUs: 900, opName: 'relu' },
        memoryTopology: topology,
      },
      swimlaneModel: null,
    });
    const baselineTopology = topologyOf('3.4');
    const nextTopology = topologyOf('5.6');
    const wrapper = mount(ProfilingReport, {
      props: {
        swimlaneModel: depsModel(),
        reportModel: markRaw(topologyReport()),
        baselines: [
          { id: 'b1', name: 'OPPROF_A', path: '/a' },
          { id: 'b9', name: 'OPPROF_C', path: '/c' },
        ],
        baselineRows: [{ id: 'row1', baselineId: 'b1', operatorId: '' }],
        baselineReports: { b1: { baselineId: 'b1', report: packOf(baselineTopology) } },
      },
      global: { stubs: { MemoryTopologyPanel: TopologyPanelStub } },
    });
    // The stacked aside receives the same baseline (PR-STATS-056) …
    expect(wrapper.findComponent({ name: 'MemoryTopologyPanel' }).props('baseline')).toEqual(
      baselineTopology,
    );

    // … and so does the 全屏 overlay's own panel (emit-carried snapshot).
    await wrapper.get('[data-testid="topology-panel-stub-fullscreen"]').trigger('click');
    const overlay = wrapper.get('[data-testid="topology-fullscreen-overlay"]');
    const fullscreen = wrapper
      .findAllComponents({ name: 'MemoryTopologyPanel' })
      .find((p) => overlay.element.contains(p.element));
    expect(fullscreen).toBeDefined();
    expect(fullscreen!.props('baseline')).toEqual(baselineTopology);
    const node = fullscreen!.element;

    // The open overlay is a one-shot snapshot: moving the row does not
    // remount the panel and does not chase the new pack.
    await wrapper.setProps({
      baselineRows: [{ id: 'row1', baselineId: 'b9', operatorId: '' }],
      baselineReports: {
        b1: { baselineId: 'b1', report: packOf(baselineTopology) },
        b9: { baselineId: 'b9', report: packOf(nextTopology) },
      },
    });
    await nextTick();
    const stillOverlay = wrapper.get('[data-testid="topology-fullscreen-overlay"]');
    const after = wrapper
      .findAllComponents({ name: 'MemoryTopologyPanel' })
      .find((p) => stillOverlay.element.contains(p.element))!;
    expect(after.element).toBe(node);
    expect(after.props('baseline')).toEqual(baselineTopology);

    // A fresh emit (re-opening) picks up the current primary resolution…
    await wrapper.get('[data-testid="topology-panel-stub-fullscreen"]').trigger('click');
    await nextTick();
    expect(after.props('baseline')).toEqual(nextTopology);

    // … and a row without a pack carries a null baseline through.
    await wrapper.setProps({ baselineReports: { b1: { baselineId: 'b1', report: packOf(baselineTopology) } } });
    await nextTick();
    await wrapper.get('[data-testid="topology-panel-stub-fullscreen"]').trigger('click');
    await nextTick();
    expect(after.props('baseline')).toBeNull();
    wrapper.unmount();
  });

  it('PR-ROOT-051b: a Metric switch rebuilds the 全屏 baseline from the picked operator', async () => {
    const { topologyFromArchDiagramMetrics } = await import('../../adapters/emulateMemoryTopology');
    const csv = (ratio: number, gbs: number, cnt: number) => [
      'ArchDiagramId,ArchDiagramParameterName,ArchDiagramParameterValue',
      `1,l2_cached_ratio,${ratio}`,
      `2,hbm_to_l2_syn_gbs,${gbs}`,
      `3,hbm_to_l2_syn_cnt,${cnt}`,
      '4,hbm_to_l2_syn_ratio,0.25',
    ].join('\n');
    const archModel = (ratio: number, gbs: number, cnt: number) => ({
      ...emptyReportViewModel(),
      profile: 'emulate' as const,
      summary: { taskDurationUs: 1000 },
      csvTexts: { 'ArchDiagramMetrics.csv': csv(ratio, gbs, cnt) },
      memoryTables: [
        {
          fileName: 'ArchDiagramMetrics.csv',
          headers: ['ArchDiagramId', 'ArchDiagramParameterName', 'ArchDiagramParameterValue'],
          rows: [],
          blockIds: [],
        },
      ],
    });
    const pickedCsv = csv(40, 4, 400);
    const defaultCsv = csv(10, 1, 100);
    const pack: AdaptedReport = {
      reportModel: archModel(10, 1, 100),
      swimlaneModel: null,
      operators: [
        { id: 'default-op', label: 'default-op' },
        { id: 'picked', label: 'picked' },
      ],
      operatorReports: {
        'default-op': { reportModel: archModel(10, 1, 100), swimlaneModel: null },
        picked: { reportModel: archModel(40, 4, 400), swimlaneModel: null },
      },
    };
    const wrapper = mount(ProfilingReport, {
      props: {
        swimlaneModel: depsModel(),
        reportModel: markRaw(archModel(90, 9, 900)),
        capabilities: ['archDiagram'],
        baselines: [{ id: 'b1', name: 'OPPROF_A', path: '/a' }],
        baselineRows: [{ id: 'row1', baselineId: 'b1', operatorId: 'picked' }],
        baselineReports: { b1: { baselineId: 'b1', report: pack } },
      },
      global: { stubs: { MemoryTopologyPanel: TopologyPanelStub } },
    });
    await wrapper.get('[data-testid="topology-panel-stub-fullscreen"]').trigger('click');
    await nextTick();
    const overlay = wrapper.get('[data-testid="topology-fullscreen-overlay"]');
    const overlayPanel = () =>
      wrapper
        .findAllComponents({ name: 'MemoryTopologyPanel' })
        .find((p) => overlay.element.contains(p.element))!;
    // Open-time snapshot resolves the PICKED operator's metrics.
    expect(overlayPanel().props('baseline')).toEqual(
      topologyFromArchDiagramMetrics(pickedCsv)!,
    );

    // Switching the overlay's Metric mode must rebuild the baseline from the
    // SAME picked operator — the pack's default operator has different bytes.
    await wrapper
      .get('[data-testid="topology-fs-metric-select"] .pr-metric-select__trigger')
      .trigger('click');
    (document.querySelector('[data-testid="topology-fs-metric-option-number_of_requests"]') as HTMLElement).click();
    await nextTick();
    expect(overlayPanel().props('baseline')).toEqual(
      topologyFromArchDiagramMetrics(pickedCsv, 'number_of_requests')!,
    );
    expect(overlayPanel().props('baseline')).not.toEqual(
      topologyFromArchDiagramMetrics(defaultCsv, 'number_of_requests')!,
    );
    wrapper.unmount();
  });

  it('PR-ROOT-032: session actions, optimize and open-cannwork forward to the host with reference and view hidden', async () => {
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
        title: 'cannwork',
        swimlaneModel: { processes: [], minTime: 0, maxTime: 1000 },
        reportModel: markRaw(reportModel),
        cannbotSessions: {
          summary: { sessionId: 's-1', status: 'completed' },
          compute: { sessionId: 'c-1', status: 'running' },
        },
      },
    });

    // sessions prop flows through to the aside's per-scope button state.
    expect(wrapper.find('[data-testid="cannbot-summary-reference"]').exists()).toBe(false);
    expect(wrapper.find('[data-testid="cannbot-summary-view"]').exists()).toBe(false);
    await wrapper.get('[data-testid="cannbot-summary"]').trigger('click');
    expect(wrapper.emitted('cannbot-request')?.[0]?.[0]).toMatchObject({ scope: 'summary' });
    await wrapper.get('[data-testid="cannbot-compute"]').trigger('click');
    expect(wrapper.emitted('open-cannbot-stop')).toEqual([['compute']]);
    await wrapper.get('[data-testid="perform-optimization-trigger"]').trigger('click');
    expect(wrapper.emitted('perform-optimization'))
      .toEqual([[{ report_path: '', op_name: 'matmul_v3' }]]);
    await wrapper.get('[data-testid="open-cannwork-trigger"]').trigger('click');
    expect(wrapper.emitted('open-cannwork')).toHaveLength(1);
    wrapper.unmount();
  });

  it('PR-ROOT-033: stop, optimize and open-cannwork each have an independent 1s cooldown', async () => {
    vi.useFakeTimers();
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
        title: 'cannwork',
        swimlaneModel: { processes: [], minTime: 0, maxTime: 1000 },
        reportModel: markRaw(reportModel),
        cannbotSessions: { compute: { sessionId: 'c-1', status: 'running' } },
      },
    });

    // First click of each action fires immediately.
    await wrapper.get('[data-testid="perform-optimization-trigger"]').trigger('click');
    expect(wrapper.emitted('perform-optimization')).toHaveLength(1);
    // Repeats of the same action inside its window are swallowed.
    await wrapper.get('[data-testid="perform-optimization-trigger"]').trigger('click');
    expect(wrapper.emitted('perform-optimization')).toHaveLength(1);

    // Independent locks: perform-optimization's cooldown does not swallow a
    // different action's first click.
    await wrapper.get('[data-testid="open-cannwork-trigger"]').trigger('click');
    expect(wrapper.emitted('open-cannwork')).toHaveLength(1);
    await wrapper.get('[data-testid="cannbot-compute"]').trigger('click');
    expect(wrapper.emitted('open-cannbot-stop')).toEqual([['compute']]);
    await wrapper.get('[data-testid="cannbot-compute"]').trigger('click');
    expect(wrapper.emitted('open-cannbot-stop')).toHaveLength(1);

    vi.advanceTimersByTime(1000);
    await wrapper.get('[data-testid="open-cannwork-trigger"]').trigger('click');
    expect(wrapper.emitted('open-cannwork')).toHaveLength(2);
    wrapper.unmount();
  });

  it('tokens.css has no partial light-theme override block (#267)', async () => {
    const css = (await import('../tokens.css?raw')).default as string;
    expect(css).not.toMatch(/\.pr-root\[data-theme=['"]light['"]\]/);
  });

  it('PR-DIFF-204: compare mode pairs the open report with the checked saved baseline and resets on tab change', async () => {
    const correlation = { ...mockSourceCorrelation(), mock: false };
    const baselineCorrelation = { ...correlation };
    const pack: AdaptedReport = {
      swimlaneModel: null,
      reportModel: { ...emptyReportViewModel(), sourceCorrelation: baselineCorrelation },
    };
    const wrapper = mount(ProfilingReport, {
      props: {
        title: 'source-compare',
        swimlaneModel: depsModel(),
        reportModel: { ...emptyReportViewModel(), sourceCorrelation: correlation },
        capabilities: ['sourceTab'],
        baselines: [{ id: 'b-1', name: '', path: '/data/a.rep' }],
        baselineRows: [{ id: 'brow-1', baselineId: 'b-1', operatorId: '' }],
        baselineReports: { 'b-1': { baselineId: 'b-1', report: pack } },
      },
    });
    await nextTick();

    await wrapper.find('[data-testid="tab-source"]').trigger('click');
    await nextTick();
    await wrapper.find('[data-testid="compare-enter"]').trigger('click');
    await nextTick();
    const view = wrapper.findComponent({ name: 'SourceDiffView' });
    expect(view.exists()).toBe(true);
    expect(view.props('baseline')).toStrictEqual(baselineCorrelation);
    expect(wrapper.get('[data-testid="compare-report-select"]').text()).toBe('a.rep');
    expect(wrapper.find('select').exists()).toBe(false);

    await wrapper.find('[data-testid="tab-timeline"]').trigger('click');
    await nextTick();
    await wrapper.find('[data-testid="tab-source"]').trigger('click');
    await nextTick();
    expect(wrapper.find('[data-testid="source-diff-view"]').exists()).toBe(false);
    expect(wrapper.find('[data-testid="compare-enter"]').exists()).toBe(true);
    wrapper.unmount();
  });

  it('PR-DIFF-204: compare search stays off the timeline query, and a new source or a disabled Source tab exits compare', async () => {
    const correlation = { ...mockSourceCorrelation(), mock: false };
    const pack: AdaptedReport = {
      swimlaneModel: null,
      reportModel: { ...emptyReportViewModel(), sourceCorrelation: correlation },
    };
    const wrapper = mount(ProfilingReport, {
      props: {
        title: 'source-compare-reset',
        swimlaneModel: depsModel(),
        reportModel: { ...emptyReportViewModel(), sourceCorrelation: correlation },
        capabilities: ['sourceTab'],
        baselines: [{ id: 'b-1', name: '', path: '/data/a.rep' }],
        baselineRows: [{ id: 'brow-1', baselineId: 'b-1', operatorId: '' }],
        baselineReports: { 'b-1': { baselineId: 'b-1', report: pack } },
      },
    });
    await nextTick();
    await wrapper.find('[data-testid="tab-source"]').trigger('click');
    await nextTick();
    await wrapper.find('[data-testid="compare-enter"]').trigger('click');
    await nextTick();
    const search = wrapper.get('[data-testid="compare-search"]');
    await search.setValue('kernel');
    await nextTick();
    expect((wrapper.vm as unknown as { viewState: { searchQuery: string } }).viewState.searchQuery).toBe('');
    expect((search.element as HTMLInputElement).value).toBe('kernel');

    await wrapper.setProps({
      reportModel: {
        ...emptyReportViewModel(),
        sourceCorrelation: { ...correlation, mock: true },
      },
    });
    await nextTick();
    expect(wrapper.find('[data-testid="source-diff-view"]').exists()).toBe(false);

    await wrapper.setProps({
      reportModel: { ...emptyReportViewModel(), sourceCorrelation: correlation },
    });
    await nextTick();
    await wrapper.find('[data-testid="tab-source"]').trigger('click');
    await nextTick();
    await wrapper.find('[data-testid="compare-enter"]').trigger('click');
    await nextTick();
    expect(wrapper.find('[data-testid="source-diff-view"]').exists()).toBe(true);
    await wrapper.setProps({ source: new Uint8Array([1, 2, 3, 4]) });
    await nextTick();
    expect(wrapper.find('[data-testid="source-diff-view"]').exists()).toBe(false);
    wrapper.unmount();
  });

  it('PR-ROOT-040: compareOnly opens compare without tabs; default keeps both tabs', async () => {
    const correlation = { ...mockSourceCorrelation(), mock: false };
    const pack: AdaptedReport = {
      swimlaneModel: null,
      reportModel: { ...emptyReportViewModel(), sourceCorrelation: correlation },
    };
    const settings = {
      title: 'compare-only',
      swimlaneModel: depsModel(),
      reportModel: { ...emptyReportViewModel(), sourceCorrelation: correlation },
      capabilities: ['sourceTab'] as ReportCapability[],
      baselines: [{ id: 'b-1', name: '', path: '/data/a.rep' }],
      baselineRows: [{ id: 'brow-1', baselineId: 'b-1', operatorId: '' }],
      baselineReports: { 'b-1': { baselineId: 'b-1', report: pack } },
    };

    const standard = mount(ProfilingReport, { props: settings });
    expect(standard.find('[data-testid="tab-timeline"]').exists()).toBe(true);
    expect(standard.find('[data-testid="tab-source"]').exists()).toBe(true);
    standard.unmount();

    const wrapper = mount(ProfilingReport, { props: { ...settings, compareOnly: true } });
    await nextTick();
    await nextTick();

    expect(wrapper.findAll('.pr-tabs__tab')).toHaveLength(0);
    expect(wrapper.find('[data-testid="source-diff-view"]').exists()).toBe(true);
    expect(wrapper.get('[data-testid="compare-report-select"]').text()).toBe('a.rep');

    await wrapper.find('[data-testid="compare-exit"]').trigger('click');
    await nextTick();
    expect(wrapper.find('[data-testid="source-diff-view"]').exists()).toBe(false);
    expect(wrapper.find('[data-testid="source-view"]').exists()).toBe(true);
    expect(wrapper.findAll('.pr-tabs__tab')).toHaveLength(0);
    wrapper.unmount();

    const single = mount(ProfilingReport, {
      props: { ...settings, compareOnly: true, swimlaneModel: undefined, baselineRows: [], baselineReports: {} },
    });
    await nextTick();
    await nextTick();
    expect(single.findAll('.pr-tabs__tab')).toHaveLength(0);
    expect(single.find('[data-testid="source-diff-view"]').exists()).toBe(true);
    expect(single.find('[data-testid="source-diff-baseline-empty"]').exists()).toBe(true);
    expect(single.find('[data-testid="source-diff-pane-host-left"]').exists()).toBe(true);
    expect(single.find('[data-testid="no-timeline"]').exists()).toBe(false);
    single.unmount();
  });

  it('PR-ROOT-054: the right pane follows the selected baseline row into its pack operator correlation', async () => {
    const correlation = markedCorrelation('open');
    const packCorrelation = markedCorrelation('pack');
    const matmulCorrelation = markedCorrelation('matmul');
    const reluCorrelation = markedCorrelation('relu');
    const adapted = (sourceCorrelation: typeof correlation): AdaptedReport => ({
      swimlaneModel: null,
      reportModel: { ...emptyReportViewModel(), sourceCorrelation },
    });
    const pack: AdaptedReport = {
      ...adapted(packCorrelation),
      reportModel: {
        ...adapted(packCorrelation).reportModel,
        summary: { ...emptyReportViewModel().summary, opName: 'matmul' },
      },
      operatorReports: { matmul: adapted(matmulCorrelation), relu: adapted(reluCorrelation) },
    };
    const wrapper = mount(ProfilingReport, {
      props: {
        title: 'baseline-backed',
        swimlaneModel: depsModel(),
        reportModel: {
          ...emptyReportViewModel(),
          summary: { ...emptyReportViewModel().summary, opName: 'relu' },
          sourceCorrelation: correlation,
        },
        capabilities: ['sourceTab'],
        baselines: [{ id: 'b-1', name: '', path: '/data/a.rep' }],
        baselineRows: [{ id: 'brow-1', baselineId: 'b-1', operatorId: '' }],
        baselineReports: { 'b-1': { baselineId: 'b-1', report: pack } },
      },
    });
    await nextTick();
    await wrapper.find('[data-testid="tab-source"]').trigger('click');
    await nextTick();
    await wrapper.find('[data-testid="compare-enter"]').trigger('click');
    await nextTick();

    // No row operator → the open report's OpName picks the pack operator.
    expect(wrapper.findComponent({ name: 'SourceDiffView' }).props('baseline')).toStrictEqual(reluCorrelation);
    expect(wrapper.find('select').exists()).toBe(false);

    // A row operator wins and re-pairs the right pane.
    await wrapper.setProps({
      baselineRows: [{ id: 'brow-1', baselineId: 'b-1', operatorId: 'matmul' }],
    });
    await nextTick();
    expect(wrapper.findComponent({ name: 'SourceDiffView' }).props('baseline')).toStrictEqual(matmulCorrelation);
    wrapper.unmount();
  });

  it('PR-ROOT-054b: the compare pair skips a row whose pack has no source correlation', async () => {
    const correlation = { ...mockSourceCorrelation(), mock: false };
    const secondCorrelation = { ...mockSourceCorrelation(), mock: false };
    const wrapper = mount(ProfilingReport, {
      props: {
        title: 'compare-skip-empty',
        swimlaneModel: depsModel(),
        reportModel: { ...emptyReportViewModel(), sourceCorrelation: correlation },
        capabilities: ['sourceTab'],
        baselines: [
          { id: 'b-1', name: '', path: '/data/first.rep' },
          { id: 'b-2', name: '', path: '/data/second.rep' },
        ],
        baselineRows: [
          { id: 'brow-1', baselineId: 'b-1', operatorId: '' },
          { id: 'brow-2', baselineId: 'b-2', operatorId: '' },
        ],
        baselineReports: {
          'b-1': {
            baselineId: 'b-1',
            report: { swimlaneModel: null, reportModel: emptyReportViewModel() },
          },
          'b-2': {
            baselineId: 'b-2',
            report: {
              swimlaneModel: null,
              reportModel: { ...emptyReportViewModel(), sourceCorrelation: secondCorrelation },
            },
          },
        },
      },
    });
    await nextTick();
    await wrapper.find('[data-testid="tab-source"]').trigger('click');
    await nextTick();

    const enter = wrapper.find('[data-testid="compare-enter"]');
    expect(enter.attributes('disabled')).toBeUndefined();
    await enter.trigger('click');
    await nextTick();

    expect(wrapper.get('[data-testid="compare-report-select"]').text()).toBe('second.rep');
    expect(wrapper.findComponent({ name: 'SourceDiffView' }).props('baseline')).toStrictEqual(secondCorrelation);
    wrapper.unmount();
  });

  it('PR-ROOT-054c: the compare pair falls back to a checked baseline with no row', async () => {
    const correlation = { ...mockSourceCorrelation(), mock: false };
    const secondCorrelation = { ...mockSourceCorrelation(), mock: false };
    const wrapper = mount(ProfilingReport, {
      props: {
        title: 'compare-checkbox-fallback',
        swimlaneModel: depsModel(),
        reportModel: { ...emptyReportViewModel(), sourceCorrelation: correlation },
        capabilities: ['sourceTab'],
        baselines: [
          { id: 'b-1', name: '', path: '/data/first.rep' },
          { id: 'b-2', name: '', path: '/data/second.rep' },
        ],
        baselineRows: [{ id: 'brow-1', baselineId: 'b-1', operatorId: '' }],
        baselineReports: {
          'b-1': {
            baselineId: 'b-1',
            report: { swimlaneModel: null, reportModel: emptyReportViewModel() },
          },
          'b-2': {
            baselineId: 'b-2',
            report: {
              swimlaneModel: null,
              reportModel: { ...emptyReportViewModel(), sourceCorrelation: secondCorrelation },
            },
          },
        },
      },
    });
    await nextTick();
    await wrapper.find('[data-testid="tab-source"]').trigger('click');
    await nextTick();

    const enter = wrapper.find('[data-testid="compare-enter"]');
    expect(enter.attributes('disabled')).toBeUndefined();
    await enter.trigger('click');
    await nextTick();

    expect(wrapper.get('[data-testid="compare-report-select"]').text()).toBe('second.rep');
    expect(wrapper.findComponent({ name: 'SourceDiffView' }).props('baseline')).toStrictEqual(secondCorrelation);
    wrapper.unmount();
  });

  it('PR-ROOT-055: a checked baseline without source opens compare on an empty right pane', async () => {
    const correlation = { ...mockSourceCorrelation(), mock: false };
    const run = (baselineCorrelation: typeof correlation | undefined) => mount(ProfilingReport, {
      props: {
        title: 'compare-entry',
        swimlaneModel: depsModel(),
        reportModel: { ...emptyReportViewModel(), sourceCorrelation: correlation },
        capabilities: ['sourceTab'],
        baselines: [{ id: 'b-1', name: '', path: '/data/a.rep' }],
        baselineRows: [{ id: 'brow-1', baselineId: 'b-1', operatorId: '' }],
        baselineReports: {
          'b-1': {
            baselineId: 'b-1',
            report: {
              swimlaneModel: null,
              reportModel: { ...emptyReportViewModel(), sourceCorrelation: baselineCorrelation },
            },
          },
        },
      },
    });

    const noBaseline = run(undefined);
    await noBaseline.find('[data-testid="tab-source"]').trigger('click');
    await nextTick();
    const enter = noBaseline.get('[data-testid="compare-enter"]');
    expect(enter.attributes('disabled')).toBeUndefined();
    await enter.trigger('click');
    await nextTick();
    expect(noBaseline.find('[data-testid="source-diff-baseline-empty"]').exists()).toBe(true);
    expect(noBaseline.find('[data-testid="source-diff-pane-host-left"]').exists()).toBe(true);
    expect(noBaseline.find('[data-testid="source-diff-workspace-right"]').exists()).toBe(false);
    noBaseline.unmount();

    const withBaseline = run(correlation);
    await withBaseline.find('[data-testid="tab-source"]').trigger('click');
    await nextTick();
    expect(withBaseline.find('[data-testid="compare-enter"]').exists()).toBe(true);
    expect(withBaseline.find('[data-testid="compare-enter"]').attributes('disabled')).toBeUndefined();
    withBaseline.unmount();
  });

  it('PR-ROOT-055b: an empty baseline with a workspace hook disables the right workspace button', async () => {
    const correlation = { ...mockSourceCorrelation(), mock: false };
    const wrapper = mount(ProfilingReport, {
      props: {
        title: 'compare-empty-workspace',
        swimlaneModel: depsModel(),
        reportModel: { ...emptyReportViewModel(), sourceCorrelation: correlation },
        capabilities: ['sourceTab'],
        baselines: [{ id: 'b-1', name: '', path: '/data/a.rep' }],
        baselineRows: [{ id: 'brow-1', baselineId: 'b-1', operatorId: '' }],
        baselineReports: {
          'b-1': {
            baselineId: 'b-1',
            report: { swimlaneModel: null, reportModel: emptyReportViewModel() },
          },
        },
        pickSourceWorkspace: vi.fn(async () => null),
        locale: 'en-US',
      },
    });
    await wrapper.find('[data-testid="tab-source"]').trigger('click');
    await nextTick();
    expect(wrapper.find('[data-testid="compare-enter"]').attributes('disabled')).toBeUndefined();
    await wrapper.find('[data-testid="compare-enter"]').trigger('click');
    await nextTick();
    expect(wrapper.find('[data-testid="source-diff-baseline-empty"]').exists()).toBe(true);
    const workspace = wrapper.get('[data-testid="source-diff-workspace-right"]');
    expect(workspace.attributes('disabled')).toBeDefined();
    expect(workspace.attributes('title')).toBe(t('sourceDiffWorkspaceBaselineDisabled', 'en-US'));
    wrapper.unmount();
  });

  it('PR-ROOT-054d: compare-report-select lists checked baselines, switches the right pane and resets the operator', async () => {
    const correlation = markedCorrelation('open');
    const firstCorrelation = markedCorrelation('first-matmul');
    const reluCorrelation = markedCorrelation('first-relu');
    const secondCorrelation = markedCorrelation('second-matmul');
    const secondReluCorrelation = markedCorrelation('second-relu');
    const adapted = (sourceCorrelation: typeof correlation): AdaptedReport => ({
      swimlaneModel: null,
      reportModel: { ...emptyReportViewModel(), sourceCorrelation },
    });
    const wrapper = mount(ProfilingReport, {
      props: {
        title: 'compare-report-select',
        swimlaneModel: depsModel(),
        reportModel: { ...emptyReportViewModel(), sourceCorrelation: correlation },
        capabilities: ['sourceTab'],
        baselines: [
          {
            id: 'b-1',
            name: '',
            path: '/data/a.rep',
            operators: [
              { id: 'matmul', label: 'MatMul' },
              { id: 'relu', label: 'Relu' },
            ],
          },
          {
            id: 'b-2',
            name: '',
            path: '/data/b.rep',
            operators: [
              { id: 'matmul', label: 'MatMul' },
              { id: 'relu', label: 'Relu' },
            ],
          },
        ],
        baselineReports: {
          'b-1': {
            baselineId: 'b-1',
            report: {
              ...adapted(firstCorrelation),
              operatorReports: { matmul: adapted(firstCorrelation), relu: adapted(reluCorrelation) },
            },
          },
          'b-2': {
            baselineId: 'b-2',
            report: {
              ...adapted(secondCorrelation),
              operatorReports: {
                matmul: adapted(secondCorrelation),
                relu: adapted(secondReluCorrelation),
              },
            },
          },
        },
      },
    });
    await wrapper.find('[data-testid="tab-source"]').trigger('click');
    await nextTick();
    await wrapper.find('[data-testid="compare-enter"]').trigger('click');
    await nextTick();
    const select = wrapper.get('[data-testid="compare-report-select"]');
    expect(select.attributes('data-value')).toBe('b-1');

    await wrapper.get('[data-testid="compare-operator-select"]').get('button').trigger('click');
    document.querySelector<HTMLElement>('[data-testid="compare-operator-option-relu"]')?.click();
    await nextTick();
    expect(wrapper.findComponent({ name: 'SourceDiffView' }).props('baseline')).toStrictEqual(reluCorrelation);

    // Re-picking the same report keeps the operator pick.
    await select.get('button').trigger('click');
    document.querySelector<HTMLElement>('[data-testid="compare-report-option-b-1"]')?.click();
    await nextTick();
    expect(wrapper.get('[data-testid="compare-operator-select"]').attributes('data-value')).toBe('relu');

    await select.get('button').trigger('click');
    document.querySelector<HTMLElement>('[data-testid="compare-report-option-b-2"]')?.click();
    await nextTick();
    expect(wrapper.get('[data-testid="compare-report-select"]').attributes('data-value')).toBe('b-2');
    expect(wrapper.get('[data-testid="compare-operator-select"]').attributes('data-value')).toBe('matmul');
    expect(wrapper.findComponent({ name: 'SourceDiffView' }).props('baseline')).toStrictEqual(secondCorrelation);

    // A non-default operator does not survive into the next report.
    await wrapper.get('[data-testid="compare-operator-select"]').get('button').trigger('click');
    document.querySelector<HTMLElement>('[data-testid="compare-operator-option-relu"]')?.click();
    await nextTick();
    expect(wrapper.findComponent({ name: 'SourceDiffView' }).props('baseline')).toStrictEqual(secondReluCorrelation);

    // A new open report clears the pair; re-opening seeds the default b-1 and operator.
    await wrapper.setProps({
      reportModel: { ...emptyReportViewModel(), sourceCorrelation: { ...mockSourceCorrelation(), mock: false } },
    });
    await nextTick();
    await wrapper.find('[data-testid="compare-enter"]').trigger('click');
    await nextTick();
    expect(wrapper.get('[data-testid="compare-report-select"]').attributes('data-value')).toBe('b-1');
    expect(wrapper.get('[data-testid="compare-operator-select"]').attributes('data-value')).toBe('matmul');
    expect(wrapper.findComponent({ name: 'SourceDiffView' }).props('baseline')).toStrictEqual(firstCorrelation);
    wrapper.unmount();
  });

  it('PR-ROOT-054f: auto-seeded compare upgrades when a later pack gains source, until an explicit pick', async () => {
    const correlation = markedCorrelation('open');
    const secondCorrelation = markedCorrelation('second');
    const thirdCorrelation = markedCorrelation('third');
    const adapted = (sourceCorrelation: typeof correlation): AdaptedReport => ({
      swimlaneModel: null,
      reportModel: { ...emptyReportViewModel(), sourceCorrelation },
    });
    const wrapper = mount(ProfilingReport, {
      props: {
        title: 'compare-late-packs',
        swimlaneModel: depsModel(),
        reportModel: { ...emptyReportViewModel(), sourceCorrelation: correlation },
        capabilities: ['sourceTab'],
        baselines: [
          { id: 'b-1', name: '', path: '/data/a.rep' },
          { id: 'b-2', name: '', path: '/data/b.rep' },
          { id: 'b-3', name: '', path: '/data/c.rep' },
        ],
        baselineRows: [],
        baselineReports: {},
        compareOnly: true,
      },
    });
    await flushPromises();
    expect(wrapper.get('[data-testid="compare-report-select"]').attributes('data-value')).toBe('b-1');

    await wrapper.setProps({
      baselineReports: { 'b-2': { baselineId: 'b-2', report: adapted(secondCorrelation) } },
    });
    await nextTick();
    expect(wrapper.get('[data-testid="compare-report-select"]').attributes('data-value')).toBe('b-2');
    expect(wrapper.findComponent({ name: 'SourceDiffView' }).props('baseline')).toStrictEqual(secondCorrelation);

    await wrapper.get('[data-testid="compare-report-select"]').get('button').trigger('click');
    document.querySelector<HTMLElement>('[data-testid="compare-report-option-b-1"]')?.click();
    await nextTick();
    expect(wrapper.get('[data-testid="compare-report-select"]').attributes('data-value')).toBe('b-1');

    await wrapper.setProps({
      baselineReports: {
        'b-2': { baselineId: 'b-2', report: adapted(secondCorrelation) },
        'b-3': { baselineId: 'b-3', report: adapted(thirdCorrelation) },
      },
    });
    await nextTick();
    expect(wrapper.get('[data-testid="compare-report-select"]').attributes('data-value')).toBe('b-1');
    wrapper.unmount();
  });

  it('PR-ROOT-054g: an operator select shows declared operators before the pack loads', async () => {
    const correlation = markedCorrelation('open');
    const matmulCorrelation = markedCorrelation('matmul');
    const reluCorrelation = markedCorrelation('relu');
    const adapted = (sourceCorrelation: typeof correlation): AdaptedReport => ({
      swimlaneModel: null,
      reportModel: { ...emptyReportViewModel(), sourceCorrelation },
    });
    const wrapper = mount(ProfilingReport, {
      props: {
        title: 'compare-late-operators',
        swimlaneModel: depsModel(),
        reportModel: {
          ...emptyReportViewModel(),
          sourceCorrelation: correlation,
        },
        capabilities: ['sourceTab'],
        baselines: [
          {
            id: 'b-1',
            name: '',
            path: '/data/a.rep',
            operators: [
              { id: 'matmul', label: 'MatMul' },
              { id: 'relu', label: 'Relu' },
            ],
          },
        ],
        baselineRows: [],
        baselineReports: {},
        compareOnly: true,
      },
    });
    await flushPromises();
    const select = wrapper.get('[data-testid="compare-operator-select"]');
    expect(select.attributes('data-value')).toBe('matmul');

    await select.get('button').trigger('click');
    document.querySelector<HTMLElement>('[data-testid="compare-operator-option-relu"]')?.click();
    await nextTick();
    expect(wrapper.get('[data-testid="compare-operator-select"]').attributes('data-value')).toBe('relu');

    // A later pack must not undo the explicit operator pick.
    await wrapper.setProps({
      baselineReports: {
        'b-1': {
          baselineId: 'b-1',
          report: {
            ...adapted(matmulCorrelation),
            operatorReports: {
              matmul: adapted(matmulCorrelation),
              relu: adapted(reluCorrelation),
            },
          },
        },
      },
    });
    await nextTick();
    expect(wrapper.get('[data-testid="compare-operator-select"]').attributes('data-value')).toBe('relu');
    expect(wrapper.findComponent({ name: 'SourceDiffView' }).props('baseline')).toStrictEqual(reluCorrelation);
    wrapper.unmount();
  });

  it('PR-ROOT-054h: manual exit then re-open seeds the default baseline again', async () => {
    const firstCorrelation = markedCorrelation('first');
    const secondCorrelation = markedCorrelation('second');
    const adapted = (sourceCorrelation: SourceCorrelationModel): AdaptedReport => ({
      swimlaneModel: null,
      reportModel: { ...emptyReportViewModel(), sourceCorrelation },
    });
    const wrapper = mount(ProfilingReport, {
      props: {
        title: 'compare-reopen',
        swimlaneModel: depsModel(),
        reportModel: { ...emptyReportViewModel(), sourceCorrelation: markedCorrelation('open') },
        capabilities: ['sourceTab'],
        baselines: [
          { id: 'b-1', name: '', path: '/data/a.rep' },
          { id: 'b-2', name: '', path: '/data/b.rep' },
        ],
        baselineReports: {
          'b-1': { baselineId: 'b-1', report: adapted(firstCorrelation) },
          'b-2': { baselineId: 'b-2', report: adapted(secondCorrelation) },
        },
        compareOnly: true,
      },
    });
    await flushPromises();
    await wrapper.get('[data-testid="compare-report-select"]').get('button').trigger('click');
    document.querySelector<HTMLElement>('[data-testid="compare-report-option-b-2"]')?.click();
    await nextTick();
    expect(wrapper.get('[data-testid="compare-report-select"]').attributes('data-value')).toBe('b-2');

    await wrapper.find('[data-testid="compare-exit"]').trigger('click');
    await nextTick();
    await wrapper.find('[data-testid="compare-enter"]').trigger('click');
    await nextTick();
    expect(wrapper.get('[data-testid="compare-report-select"]').attributes('data-value')).toBe('b-1');
    expect(wrapper.findComponent({ name: 'SourceDiffView' }).props('baseline')).toStrictEqual(firstCorrelation);
    wrapper.unmount();
  });

  it('PR-ROOT-054e: compare-operator-select lists the baseline operators and switches the right pane', async () => {
    const correlation = markedCorrelation('open');
    const matmulCorrelation = markedCorrelation('matmul');
    const reluCorrelation = markedCorrelation('relu');
    const adapted = (sourceCorrelation: typeof correlation): AdaptedReport => ({
      swimlaneModel: null,
      reportModel: { ...emptyReportViewModel(), sourceCorrelation },
    });
    const wrapper = mount(ProfilingReport, {
      props: {
        title: 'compare-operator-select',
        swimlaneModel: depsModel(),
        reportModel: { ...emptyReportViewModel(), sourceCorrelation: correlation },
        capabilities: ['sourceTab'],
        baselines: [
          {
            id: 'b-1',
            name: '',
            path: '/data/a.rep',
            operators: [
              { id: 'matmul', label: 'MatMul' },
              { id: 'relu', label: 'Relu' },
            ],
          },
        ],
        baselineReports: {
          'b-1': {
            baselineId: 'b-1',
            report: {
              ...adapted(matmulCorrelation),
              operatorReports: {
                matmul: adapted(matmulCorrelation),
                relu: adapted(reluCorrelation),
              },
            },
          },
        },
      },
    });
    await wrapper.find('[data-testid="tab-source"]').trigger('click');
    await nextTick();
    await wrapper.find('[data-testid="compare-enter"]').trigger('click');
    await nextTick();
    const select = wrapper.get('[data-testid="compare-operator-select"]');
    expect(select.attributes('data-value')).toBe('matmul');
    expect(select.text()).toBe('MatMul');

    await select.get('button').trigger('click');
    document.querySelector<HTMLElement>('[data-testid="compare-operator-option-relu"]')?.click();
    await nextTick();
    expect(wrapper.get('[data-testid="compare-operator-select"]').attributes('data-value')).toBe('relu');
    expect(wrapper.findComponent({ name: 'SourceDiffView' }).props('baseline')).toStrictEqual(reluCorrelation);
    wrapper.unmount();
  });

  it('PR-ROOT-055c: removing checked baselines moves compare to the next one, then exits', async () => {
    const correlation = { ...mockSourceCorrelation(), mock: false };
    const secondCorrelation = { ...mockSourceCorrelation(), mock: false };
    const pack = (sourceCorrelation: SourceCorrelationModel): AdaptedReport => ({
      swimlaneModel: null,
      reportModel: { ...emptyReportViewModel(), sourceCorrelation },
    });
    const wrapper = mount(ProfilingReport, {
      props: {
        title: 'compare-remove',
        swimlaneModel: depsModel(),
        reportModel: { ...emptyReportViewModel(), sourceCorrelation: correlation },
        capabilities: ['sourceTab'],
        baselines: [
          { id: 'b-1', name: '', path: '/data/a.rep' },
          { id: 'b-2', name: '', path: '/data/b.rep' },
        ],
        baselineReports: {
          'b-1': { baselineId: 'b-1', report: pack(correlation) },
          'b-2': { baselineId: 'b-2', report: pack(secondCorrelation) },
        },
      },
    });
    await wrapper.find('[data-testid="tab-source"]').trigger('click');
    await nextTick();
    await wrapper.find('[data-testid="compare-enter"]').trigger('click');
    await nextTick();
    expect(wrapper.get('[data-testid="compare-report-select"]').attributes('data-value')).toBe('b-1');

    await wrapper.setProps({ baselines: [{ id: 'b-2', name: '', path: '/data/b.rep' }] });
    await nextTick();
    expect(wrapper.get('[data-testid="compare-report-select"]').attributes('data-value')).toBe('b-2');
    expect(wrapper.findComponent({ name: 'SourceDiffView' }).props('baseline')).toStrictEqual(secondCorrelation);

    await wrapper.setProps({ baselines: [] });
    await nextTick();
    expect(wrapper.find('[data-testid="source-diff-view"]').exists()).toBe(false);
    expect(wrapper.find('[data-testid="source-view"]').exists()).toBe(true);
    wrapper.unmount();
  });

  it('PR-DIFF-211: explicit compare exit lands on the Source tab', async () => {
    const correlation = { ...mockSourceCorrelation(), mock: false };
    const pack: AdaptedReport = {
      swimlaneModel: null,
      reportModel: { ...emptyReportViewModel(), sourceCorrelation: { ...correlation } },
    };
    const wrapper = mount(ProfilingReport, {
      props: {
        title: 'source-compare-exit',
        swimlaneModel: depsModel(),
        reportModel: { ...emptyReportViewModel(), sourceCorrelation: correlation },
        capabilities: ['sourceTab'],
        baselines: [{ id: 'b-1', name: '', path: '/data/a.rep' }],
        baselineRows: [{ id: 'brow-1', baselineId: 'b-1', operatorId: '' }],
        baselineReports: { 'b-1': { baselineId: 'b-1', report: pack } },
      },
    });
    await nextTick();

    await wrapper.find('[data-testid="tab-source"]').trigger('click');
    await nextTick();
    expect(wrapper.find('[data-testid="tab-source"]').exists()).toBe(true);
    await wrapper.find('[data-testid="compare-enter"]').trigger('click');
    await nextTick();
    expect(wrapper.find('[data-testid="source-diff-view"]').exists()).toBe(true);

    await wrapper.find('[data-testid="compare-exit"]').trigger('click');
    await nextTick();
    expect(wrapper.find('[data-testid="source-diff-view"]').exists()).toBe(false);
    expect(wrapper.find('[data-testid="source-view"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="tab-source"]').classes()).toContain('pr-tabs__tab--active');

    // Programmatic reset: a replaced report closes compare and keeps the tab.
    await wrapper.find('[data-testid="compare-enter"]').trigger('click');
    await nextTick();
    expect(wrapper.find('[data-testid="source-diff-view"]').exists()).toBe(true);
    await wrapper.setProps({
      reportModel: { ...emptyReportViewModel(), sourceCorrelation: { ...correlation } },
    });
    await nextTick();
    expect(wrapper.find('[data-testid="source-diff-view"]').exists()).toBe(false);
    expect(wrapper.find('[data-testid="source-view"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="tab-source"]').classes()).toContain('pr-tabs__tab--active');
    wrapper.unmount();
  });

  /** Single-file correlation with the text the test wants (real text or a placeholder). */
  function correlationWith(path: string, text: string): SourceCorrelationModel {
    const base = mockSourceCorrelation();
    return {
      ...base,
      mock: false,
      files: [{ ...base.files[0]!, id: path.split('/').pop() ?? path, path, text }],
    };
  }

  it('PR-ROOT-056: workspace pick fills open-report placeholders and the export carries the text', async () => {
    const { loadNpuRepBuffer } = await import('../../../tests/helpers/fixtures');
    const path = '/sdk/kernel.asc';
    const missing = correlationWith(path, `${MISSING_SOURCE_EMBED_PREFIX}${path}\n`);
    missing.files[0]!.id = '7';
    const pick = vi.fn(async () => ({
      files: [{ path: 'kernels/kernel.asc', text: 'float gather_2d(float x) { return x; }' }],
    }));
    const wrapper = mount(ProfilingReport, {
      attachTo: document.body,
      props: {
        swimlaneModel: depsModel(),
        reportModel: { ...emptyReportViewModel(), sourceCorrelation: missing },
        source: loadNpuRepBuffer(),
        capabilities: ['sourceTab'],
        allowHtmlExport: true,
        locale: 'en',
        pickSourceWorkspace: pick,
      },
    });
    await nextTick();
    const vm = wrapper.vm as unknown as {
      report: { sourceCorrelation: SourceCorrelationModel | null };
      reportSourceNeedsResolve: boolean;
    };
    expect(vm.reportSourceNeedsResolve).toBe(true);
    // Real button in SourceView's pane bar, not the handler behind it.
    await wrapper.find('[data-testid="tab-source"]').trigger('click');
    await flushPromises();
    const workspaceButton = wrapper.find('[data-testid="source-workspace-pick"]');
    expect(workspaceButton.exists()).toBe(true);
    await workspaceButton.trigger('click');
    await flushPromises();
    expect(pick).toHaveBeenCalledWith([{ fileName: path, basename: 'kernel.asc' }]);
    expect(vm.report.sourceCorrelation!.files[0]!.text).toContain('float gather_2d');
    expect(vm.reportSourceNeedsResolve).toBe(false);
    expect(wrapper.find('[data-testid="source-workspace-pick"]').exists()).toBe(false);
    await wrapper.find('[data-testid="tab-timeline"]').trigger('click');
    await nextTick();
    expect(wrapper.find('[data-testid="export-html"]').exists()).toBe(true);

    const template = `<!doctype html><html lang="zh-CN"><head><title>x</title></head><body>
<!-- __NPU_REP_EMBED_START__ -->
<script>window.__NPU_REP_B64__='__HTML_EXPORT_B64__';window.__NPU_REP_NAME__='__HTML_EXPORT_NAME__';window.__NPU_REP_LOCALE__='__HTML_EXPORT_LOCALE__';</script>
<!-- __NPU_REP_EMBED_END__ --></body></html>`;
    let resolveFetch: (value: { ok: boolean; text: () => Promise<string> }) => void = () => undefined;
    vi.stubGlobal(
      'fetch',
      vi.fn(
        () =>
          new Promise((resolve) => {
            resolveFetch = resolve;
          }),
      ),
    );
    let stitched = '';
    const OrigBlob = globalThis.Blob;
    vi.stubGlobal(
      'Blob',
      class extends OrigBlob {
        constructor(parts?: BlobPart[], options?: BlobPropertyBag) {
          super(parts, options);
          stitched = String(parts?.[0] ?? '');
        }
      },
    );
    vi.stubGlobal('URL', {
      createObjectURL: () => 'blob:export',
      revokeObjectURL: () => undefined,
    });
    const realCreate = document.createElement.bind(document);
    vi.spyOn(document, 'createElement').mockImplementation((tag, opts) => {
      const el = realCreate(tag, opts as ElementCreationOptions);
      if (tag === 'a') el.click = vi.fn();
      return el;
    });
    await wrapper.find('[data-testid="export-html"]').trigger('click');
    await flushPromises();
    resolveFetch({ ok: true, text: async () => template });
    await flushPromises();
    expect(stitched).toContain('window.__NPU_SOURCE_TEXTS__');
    expect(stitched).toContain('float gather_2d');
    const embedded = /window\.__NPU_SOURCE_TEXTS__ = (.*?);<\/script>/.exec(stitched);
    expect(embedded).not.toBeNull();
    const texts = JSON.parse(embedded![1]!) as Record<string, string>;
    expect(texts[path]).toContain('float gather_2d');
    expect(texts['7']).toBeUndefined();
    const refilled = await resolveMissingSourceFiles(
      missing,
      workspaceSourceResolver(sourceWorkspaceFromTexts(texts)!),
    );
    expect(refilled.files[0]!.id).toBe('7');
    expect(refilled.files[0]!.text).toContain('float gather_2d');
    wrapper.unmount();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('PR-ROOT-057: the baseline workspace button fills the compare side only', async () => {
    const current = correlationWith('/src/kernel.asc', 'int main() { return 0; }\n');
    const missing = correlationWith(
      '/build/kernel.asc',
      `${MISSING_SOURCE_EMBED_PREFIX}/build/kernel.asc\n`,
    );
    const pack: AdaptedReport = {
      swimlaneModel: null,
      reportModel: { ...emptyReportViewModel(), sourceCorrelation: missing },
    };
    const pick = vi.fn(async () => ({
      files: [{ path: 'kernel.asc', text: 'int baseline() { return 1; }' }],
    }));
    const wrapper = mount(ProfilingReport, {
      props: {
        title: 'workspace-baseline',
        swimlaneModel: depsModel(),
        reportModel: { ...emptyReportViewModel(), sourceCorrelation: current },
        capabilities: ['sourceTab'],
        baselines: [{ id: 'b-1', name: '', path: '/data/a.rep' }],
        baselineRows: [{ id: 'brow-1', baselineId: 'b-1', operatorId: '' }],
        baselineReports: { 'b-1': { baselineId: 'b-1', report: pack } },
        pickSourceWorkspace: pick,
      },
    });
    await nextTick();
    await wrapper.find('[data-testid="tab-source"]').trigger('click');
    await nextTick();
    await wrapper.find('[data-testid="compare-enter"]').trigger('click');
    await nextTick();
    expect(wrapper.find('[data-testid="source-diff-workspace-left"]').exists()).toBe(false);
    expect(wrapper.find('[data-testid="source-diff-workspace-right"]').exists()).toBe(true);
    await wrapper.find('[data-testid="source-diff-workspace-right"]').trigger('click');
    await flushPromises();
    expect(pick).toHaveBeenCalledWith([{ fileName: '/build/kernel.asc', basename: 'kernel.asc' }]);
    const baseline = wrapper.findComponent(SourceDiffView).props('baseline') as SourceCorrelationModel;
    expect(baseline.files[0]!.text).toContain('int baseline()');
    const open = wrapper.findComponent(SourceDiffView).props('current') as SourceCorrelationModel;
    expect(open.files[0]!.text).toContain('int main()');
    expect(wrapper.find('[data-testid="source-diff-workspace-right"]').exists()).toBe(false);
    // Republishing the same pack object keeps the fill.
    await wrapper.setProps({ baselineReports: { 'b-1': { baselineId: 'b-1', report: pack } } });
    await nextTick();
    expect(
      (wrapper.findComponent(SourceDiffView).props('baseline') as SourceCorrelationModel).files[0]!.text,
    ).toContain('int baseline()');
    // A new pack object clears the overlay, so the placeholder returns.
    await wrapper.setProps({
      baselineReports: {
        'b-1': { baselineId: 'b-1', report: { ...pack, reportModel: { ...pack.reportModel } } },
      },
    });
    await nextTick();
    expect(wrapper.find('[data-testid="source-diff-workspace-right"]').exists()).toBe(true);
    wrapper.unmount();
  });

  it('an operator with no source does not show another operator, and Escape on the selector exits', async () => {
    const current = correlationWith('/src/kernel.asc', 'int main() { return 0; }\n');
    const matmul = correlationWith('/src/matmul.asc', 'int matmul() { return 1; }\n');
    const pack: AdaptedReport = {
      swimlaneModel: null,
      reportModel: { ...emptyReportViewModel(), sourceCorrelation: matmul },
      operatorReports: {
        matmul: {
          swimlaneModel: null,
          reportModel: { ...emptyReportViewModel(), sourceCorrelation: matmul },
        },
        relu: { swimlaneModel: null, reportModel: emptyReportViewModel() },
      },
    };
    const wrapper = mount(ProfilingReport, {
      props: {
        title: 'operator-without-source',
        swimlaneModel: depsModel(),
        reportModel: { ...emptyReportViewModel(), sourceCorrelation: current },
        capabilities: ['sourceTab'],
        baselines: [{
          id: 'b-1',
          name: '',
          path: '/data/a.rep',
          operators: [{ id: 'matmul', label: 'MatMul' }, { id: 'relu', label: 'Relu' }],
        }],
        baselineRows: [{ id: 'brow-1', baselineId: 'b-1', operatorId: 'matmul' }],
        baselineReports: { 'b-1': { baselineId: 'b-1', report: pack } },
      },
      attachTo: document.body,
    });
    await nextTick();
    await wrapper.find('[data-testid="tab-source"]').trigger('click');
    await nextTick();
    await wrapper.find('[data-testid="compare-enter"]').trigger('click');
    await nextTick();
    expect(
      (wrapper.findComponent(SourceDiffView).props('baseline') as SourceCorrelationModel).files[0]!.text,
    ).toContain('int matmul()');
    await wrapper.find('[data-testid="compare-operator-select"] button').trigger('click');
    document.querySelector<HTMLElement>('[data-testid="compare-operator-option-relu"]')?.click();
    await nextTick();
    expect(wrapper.find('[data-testid="source-diff-baseline-empty"]').exists()).toBe(true);

    const select = wrapper.get('[data-testid="compare-operator-select"]').element;
    select.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    await nextTick();
    expect(wrapper.find('[data-testid="source-diff-view"]').exists()).toBe(false);
    wrapper.unmount();
  });

  it('a declared operator missing from the pack does not reuse the root source', async () => {
    const current = correlationWith('/src/kernel.asc', 'int main() { return 0; }\n');
    const matmul = correlationWith('/src/matmul.asc', 'int matmul() { return 1; }\n');
    const pack: AdaptedReport = {
      swimlaneModel: null,
      reportModel: { ...emptyReportViewModel(), sourceCorrelation: matmul },
      operatorReports: {
        matmul: {
          swimlaneModel: null,
          reportModel: { ...emptyReportViewModel(), sourceCorrelation: matmul },
        },
      },
    };
    const wrapper = mount(ProfilingReport, {
      props: {
        title: 'missing-operator-key',
        swimlaneModel: depsModel(),
        reportModel: { ...emptyReportViewModel(), sourceCorrelation: current },
        capabilities: ['sourceTab'],
        baselines: [{
          id: 'b-1',
          name: '',
          path: '/data/a.rep',
          operators: [{ id: 'matmul', label: 'MatMul' }, { id: 'softmax', label: 'Softmax' }],
        }],
        baselineRows: [{ id: 'brow-1', baselineId: 'b-1', operatorId: 'softmax' }],
        baselineReports: { 'b-1': { baselineId: 'b-1', report: pack } },
      },
    });
    await nextTick();
    await wrapper.find('[data-testid="tab-source"]').trigger('click');
    await nextTick();
    await wrapper.find('[data-testid="compare-enter"]').trigger('click');
    await nextTick();
    expect(wrapper.find('[data-testid="source-diff-baseline-empty"]').exists()).toBe(true);
    wrapper.unmount();
  });

  it('PR-ROOT-058: the baseline workspace button is hidden when the pack text is real', async () => {
    const current = correlationWith('/src/kernel.asc', 'int main() { return 0; }\n');
    const real = correlationWith('/build/kernel.asc', 'int baseline() { return 1; }\n');
    const pack: AdaptedReport = {
      swimlaneModel: null,
      reportModel: { ...emptyReportViewModel(), sourceCorrelation: real },
    };
    const wrapper = mount(ProfilingReport, {
      props: {
        title: 'workspace-baseline-real',
        swimlaneModel: depsModel(),
        reportModel: { ...emptyReportViewModel(), sourceCorrelation: current },
        capabilities: ['sourceTab'],
        baselines: [{ id: 'b-1', name: '', path: '/data/a.rep' }],
        baselineRows: [{ id: 'brow-1', baselineId: 'b-1', operatorId: '' }],
        baselineReports: { 'b-1': { baselineId: 'b-1', report: pack } },
        pickSourceWorkspace: vi.fn(async () => null),
      },
    });
    await nextTick();
    await wrapper.find('[data-testid="tab-source"]').trigger('click');
    await nextTick();
    await wrapper.find('[data-testid="compare-enter"]').trigger('click');
    await nextTick();
    expect(wrapper.find('[data-testid="source-diff-workspace-left"]').exists()).toBe(false);
    expect(wrapper.find('[data-testid="source-diff-workspace-right"]').exists()).toBe(false);
    wrapper.unmount();
  });

  it('PR-ROOT-065: both compare workspace buttons are hidden without a picker hook', async () => {
    const current = correlationWith(
      '/src/kernel.asc',
      `${MISSING_SOURCE_EMBED_PREFIX}/src/kernel.asc\n`,
    );
    const missing = correlationWith(
      '/build/kernel.asc',
      `${MISSING_SOURCE_EMBED_PREFIX}/build/kernel.asc\n`,
    );
    const pack: AdaptedReport = {
      swimlaneModel: null,
      reportModel: { ...emptyReportViewModel(), sourceCorrelation: missing },
    };
    const wrapper = mount(ProfilingReport, {
      props: {
        title: 'workspace-no-hook-compare',
        swimlaneModel: depsModel(),
        reportModel: { ...emptyReportViewModel(), sourceCorrelation: current },
        capabilities: ['sourceTab'],
        baselines: [{ id: 'b-1', name: '', path: '/data/a.rep' }],
        baselineRows: [{ id: 'brow-1', baselineId: 'b-1', operatorId: '' }],
        baselineReports: { 'b-1': { baselineId: 'b-1', report: pack } },
      },
    });
    await nextTick();
    await wrapper.find('[data-testid="tab-source"]').trigger('click');
    await nextTick();
    await wrapper.find('[data-testid="compare-enter"]').trigger('click');
    await nextTick();
    expect(wrapper.find('[data-testid="source-diff-view"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="source-diff-workspace-left"]').exists()).toBe(false);
    expect(wrapper.find('[data-testid="source-diff-workspace-right"]').exists()).toBe(false);
    wrapper.unmount();
  });

  it('PR-ROOT-059: the workspace button is hidden without a picker hook', async () => {
    const missing = correlationWith(
      '/build/src/gather_2d.asc',
      `${MISSING_SOURCE_EMBED_PREFIX}/build/src/gather_2d.asc\n`,
    );
    const wrapper = mount(ProfilingReport, {
      props: {
        title: 'workspace-no-hook',
        swimlaneModel: depsModel(),
        reportModel: { ...emptyReportViewModel(), sourceCorrelation: missing },
        capabilities: ['sourceTab'],
      },
    });
    await nextTick();
    await wrapper.find('[data-testid="tab-source"]').trigger('click');
    await nextTick();
    expect(wrapper.find('[data-testid="source-view"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="source-workspace-pick"]').exists()).toBe(false);
    wrapper.unmount();
  });

  it('PR-ROOT-060: a baseline pick never overwrites the open-report export text', async () => {
    const { loadNpuRepBuffer } = await import('../../../tests/helpers/fixtures');
    const current = correlationWith(
      '/cur/kernel.asc',
      `${MISSING_SOURCE_EMBED_PREFIX}/cur/kernel.asc\n`,
    );
    const baseline = correlationWith(
      '/base/kernel.asc',
      `${MISSING_SOURCE_EMBED_PREFIX}/base/kernel.asc\n`,
    );
    const pack: AdaptedReport = {
      swimlaneModel: null,
      reportModel: { ...emptyReportViewModel(), sourceCorrelation: baseline },
    };
    const pick = vi.fn(async (request: { fileName: string }[]) => {
      const base = request[0]!.fileName.startsWith('/base/');
      return {
        files: [{ path: 'kernel.asc', text: base ? 'int BASELINE_TEXT()' : 'int CURRENT_TEXT()' }],
      };
    });
    const wrapper = mount(ProfilingReport, {
      attachTo: document.body,
      props: {
        title: 'workspace-same-basename',
        swimlaneModel: depsModel(),
        reportModel: { ...emptyReportViewModel(), sourceCorrelation: current },
        source: loadNpuRepBuffer(),
        capabilities: ['sourceTab'],
        allowHtmlExport: true,
        locale: 'en',
        baselines: [{ id: 'b-1', name: '', path: '/data/a.rep' }],
        baselineRows: [{ id: 'brow-1', baselineId: 'b-1', operatorId: '' }],
        baselineReports: { 'b-1': { baselineId: 'b-1', report: pack } },
        pickSourceWorkspace: pick,
      },
    });
    await flushPromises();
    const vm = wrapper.vm as unknown as {
      onPickReportSourceWorkspace: () => Promise<void>;
      onPickBaselineSourceWorkspace: () => Promise<void>;
      resolvedSourceTexts: Record<string, string>;
      report: { sourceCorrelation: SourceCorrelationModel | null };
    };
    await vm.onPickReportSourceWorkspace();
    await nextTick();
    expect(vm.resolvedSourceTexts).toEqual({ '/cur/kernel.asc': 'int CURRENT_TEXT()' });

    await vm.onPickBaselineSourceWorkspace();
    await nextTick();
    expect(vm.resolvedSourceTexts).toEqual({ '/cur/kernel.asc': 'int CURRENT_TEXT()' });
    expect(vm.report.sourceCorrelation!.files[0]!.text).toContain('CURRENT_TEXT');

    const template = `<!doctype html><html lang="zh-CN"><head><title>x</title></head><body>
<!-- __NPU_REP_EMBED_START__ -->
<script>window.__NPU_REP_B64__='__HTML_EXPORT_B64__';window.__NPU_REP_NAME__='__HTML_EXPORT_NAME__';window.__NPU_REP_LOCALE__='__HTML_EXPORT_LOCALE__';</script>
<!-- __NPU_REP_EMBED_END__ --></body></html>`;
    let resolveFetch: (value: { ok: boolean; text: () => Promise<string> }) => void = () => undefined;
    vi.stubGlobal(
      'fetch',
      vi.fn(
        () =>
          new Promise((resolve) => {
            resolveFetch = resolve;
          }),
      ),
    );
    let stitched = '';
    const OrigBlob = globalThis.Blob;
    vi.stubGlobal(
      'Blob',
      class extends OrigBlob {
        constructor(parts?: BlobPart[], options?: BlobPropertyBag) {
          super(parts, options);
          stitched = String(parts?.[0] ?? '');
        }
      },
    );
    vi.stubGlobal('URL', {
      createObjectURL: () => 'blob:export',
      revokeObjectURL: () => undefined,
    });
    const realCreate = document.createElement.bind(document);
    vi.spyOn(document, 'createElement').mockImplementation((tag, opts) => {
      const el = realCreate(tag, opts as ElementCreationOptions);
      if (tag === 'a') el.click = vi.fn();
      return el;
    });
    await wrapper.find('[data-testid="export-html"]').trigger('click');
    await flushPromises();
    resolveFetch({ ok: true, text: async () => template });
    await flushPromises();
    expect(stitched).toContain('CURRENT_TEXT');
    expect(stitched).not.toContain('BASELINE_TEXT');
    wrapper.unmount();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('PR-ROOT-061: a baseline pick keeps an in-flight open-report resolve alive', async () => {
    const current = correlationWith(
      '/cur/kernel.asc',
      `${MISSING_SOURCE_EMBED_PREFIX}/cur/kernel.asc\n`,
    );
    const baseline = correlationWith(
      '/base/kernel.asc',
      `${MISSING_SOURCE_EMBED_PREFIX}/base/kernel.asc\n`,
    );
    const pack: AdaptedReport = {
      swimlaneModel: null,
      reportModel: { ...emptyReportViewModel(), sourceCorrelation: baseline },
    };
    let release: (text: string) => void = () => undefined;
    const resolveSourceFile = vi.fn(
      () => new Promise<string>((resolve) => { release = resolve; }),
    );
    const pick = vi.fn(async () => ({
      files: [{ path: 'kernel.asc', text: 'int BASELINE_TEXT()' }],
    }));
    const wrapper = mount(ProfilingReport, {
      props: {
        title: 'workspace-inflight-report',
        swimlaneModel: depsModel(),
        reportModel: { ...emptyReportViewModel(), sourceCorrelation: current },
        capabilities: ['sourceTab'],
        locale: 'en',
        baselines: [{ id: 'b-1', name: '', path: '/data/a.rep' }],
        baselineRows: [{ id: 'brow-1', baselineId: 'b-1', operatorId: '' }],
        baselineReports: { 'b-1': { baselineId: 'b-1', report: pack } },
        resolveSourceFile,
        pickSourceWorkspace: pick,
      },
    });
    await nextTick();
    const vm = wrapper.vm as unknown as {
      onPickBaselineSourceWorkspace: () => Promise<void>;
      report: { sourceCorrelation: SourceCorrelationModel | null };
    };
    await vm.onPickBaselineSourceWorkspace();
    release('int CURRENT_TEXT()');
    await flushPromises();
    expect(vm.report.sourceCorrelation!.files[0]!.text).toContain('CURRENT_TEXT');
    wrapper.unmount();
  });

  it('PR-ROOT-062: a report swap while the pick dialog is open drops the stale fill', async () => {
    const oldPath = '/old/kernel.asc';
    const newPath = '/new/kernel.asc';
    const missing = (path: string) =>
      correlationWith(path, `${MISSING_SOURCE_EMBED_PREFIX}${path}\n`);
    let openPick: (pick: { files: Array<{ path: string; text: string }> }) => void = () => undefined;
    const pick = vi.fn(
      () =>
        new Promise<{ files: Array<{ path: string; text: string }> }>((resolve) => {
          openPick = resolve;
        }),
    );
    const wrapper = mount(ProfilingReport, {
      props: {
        title: 'workspace-swap-while-picking',
        swimlaneModel: depsModel(),
        reportModel: { ...emptyReportViewModel(), sourceCorrelation: missing(oldPath) },
        capabilities: ['sourceTab'],
        pickSourceWorkspace: pick,
      },
    });
    await nextTick();
    const vm = wrapper.vm as unknown as {
      onPickReportSourceWorkspace: () => Promise<void>;
      resolvedSourceTexts: Record<string, string>;
      report: { sourceCorrelation: SourceCorrelationModel | null };
    };
    const pending = vm.onPickReportSourceWorkspace();
    await nextTick();
    await wrapper.setProps({
      reportModel: { ...emptyReportViewModel(), sourceCorrelation: missing(newPath) },
    });
    await nextTick();
    openPick({ files: [{ path: 'kernel.asc', text: 'int STALE()' }] });
    await pending;
    await flushPromises();

    expect(vm.report.sourceCorrelation!.files[0]!.text.startsWith(MISSING_SOURCE_EMBED_PREFIX)).toBe(
      true,
    );
    expect(vm.resolvedSourceTexts).toEqual({});
    wrapper.unmount();
  });

  it('PR-ROOT-063: only text the fill changed enters the export map', async () => {
    const base = correlationWith('/build/a.asc', `${MISSING_SOURCE_EMBED_PREFIX}/build/a.asc\n`);
    const embedded = 'int embedded() { return 1; }\n';
    const model: SourceCorrelationModel = {
      ...base,
      files: [
        { ...base.files[0]!, id: '7', path: '/build/a.asc' },
        { ...base.files[0]!, id: 'b.asc', path: '/build/b.asc', text: embedded },
      ],
    };
    const pick = vi.fn(async () => ({
      files: [
        { path: 'a.asc', text: 'int a() { return 0; }\n' },
        { path: 'b.asc', text: 'int b() { return 2; }\n' },
      ],
    }));
    const wrapper = mount(ProfilingReport, {
      props: {
        title: 'workspace-export-map',
        swimlaneModel: depsModel(),
        reportModel: { ...emptyReportViewModel(), sourceCorrelation: model },
        capabilities: ['sourceTab'],
        pickSourceWorkspace: pick,
      },
    });
    await nextTick();
    const vm = wrapper.vm as unknown as {
      onPickReportSourceWorkspace: () => Promise<void>;
      resolvedSourceTexts: Record<string, string>;
      report: { sourceCorrelation: SourceCorrelationModel | null };
    };
    await vm.onPickReportSourceWorkspace();
    await nextTick();

    expect(vm.report.sourceCorrelation!.files[1]!.text).toBe(embedded);
    expect(vm.resolvedSourceTexts).toEqual({ '/build/a.asc': 'int a() { return 0; }\n' });
    wrapper.unmount();
  });

  it('PR-ROOT-064: a second baseline pick accumulates on the first one', async () => {
    const current = correlationWith('/src/kernel.asc', 'int main() { return 0; }\n');
    const base = correlationWith(
      '/build/a.asc',
      `${MISSING_SOURCE_EMBED_PREFIX}/build/a.asc\n`,
    );
    const missing = (path: string) =>
      correlationWith(path, `${MISSING_SOURCE_EMBED_PREFIX}${path}\n`).files[0]!;
    const twoFiles: SourceCorrelationModel = {
      ...base,
      files: [
        { ...missing('/build/a.asc'), id: 'a.asc' },
        { ...missing('/build/b.asc'), id: 'b.asc' },
      ],
    };
    const pack: AdaptedReport = {
      swimlaneModel: null,
      reportModel: { ...emptyReportViewModel(), sourceCorrelation: twoFiles },
    };
    const pick = vi.fn(async (request: { basename: string }[]) => {
      const name = request[0]!.basename;
      return { files: [{ path: name, text: `int ${name.replace('.asc', '')}() {}\n` }] };
    });
    const wrapper = mount(ProfilingReport, {
      props: {
        title: 'workspace-baseline-accumulate',
        swimlaneModel: depsModel(),
        reportModel: { ...emptyReportViewModel(), sourceCorrelation: current },
        capabilities: ['sourceTab'],
        baselines: [{ id: 'b-1', name: '', path: '/data/a.rep' }],
        baselineRows: [{ id: 'brow-1', baselineId: 'b-1', operatorId: '' }],
        baselineReports: { 'b-1': { baselineId: 'b-1', report: pack } },
        pickSourceWorkspace: pick,
      },
    });
    await nextTick();
    await wrapper.find('[data-testid="tab-source"]').trigger('click');
    await nextTick();
    await wrapper.find('[data-testid="compare-enter"]').trigger('click');
    await nextTick();

    await wrapper.find('[data-testid="source-diff-workspace-right"]').trigger('click');
    await flushPromises();
    let baseline = wrapper.findComponent(SourceDiffView).props('baseline') as SourceCorrelationModel;
    expect(baseline.files[0]!.text).toContain('int a()');
    expect(baseline.files[1]!.text.startsWith(MISSING_SOURCE_EMBED_PREFIX)).toBe(true);

    await wrapper.find('[data-testid="source-diff-workspace-right"]').trigger('click');
    await flushPromises();
    expect(pick).toHaveBeenLastCalledWith([{ fileName: '/build/b.asc', basename: 'b.asc' }]);
    baseline = wrapper.findComponent(SourceDiffView).props('baseline') as SourceCorrelationModel;
    expect(baseline.files[0]!.text).toContain('int a()');
    expect(baseline.files[1]!.text).toContain('int b()');
    wrapper.unmount();
  });

  it('a baseline pick is dropped when its pack is replaced while compare is closed', async () => {
    const current = correlationWith('/src/kernel.asc', 'int main() { return 0; }\n');
    const missingPack = (): AdaptedReport => ({
      swimlaneModel: null,
      reportModel: {
        ...emptyReportViewModel(),
        sourceCorrelation: correlationWith(
          '/build/kernel.asc',
          `${MISSING_SOURCE_EMBED_PREFIX}/build/kernel.asc\n`,
        ),
      },
    });
    const pick = vi.fn(async () => ({
      files: [{ path: 'kernel.asc', text: 'int baseline() { return 1; }' }],
    }));
    const wrapper = mount(ProfilingReport, {
      props: {
        title: 'workspace-pack-swap-closed',
        swimlaneModel: depsModel(),
        reportModel: { ...emptyReportViewModel(), sourceCorrelation: current },
        capabilities: ['sourceTab'],
        baselines: [{ id: 'b-1', name: '', path: '/data/a.rep' }],
        baselineRows: [{ id: 'brow-1', baselineId: 'b-1', operatorId: '' }],
        baselineReports: { 'b-1': { baselineId: 'b-1', report: missingPack() } },
        pickSourceWorkspace: pick,
      },
    });
    await nextTick();
    await wrapper.find('[data-testid="tab-source"]').trigger('click');
    await nextTick();
    await wrapper.find('[data-testid="compare-enter"]').trigger('click');
    await nextTick();
    await wrapper.find('[data-testid="source-diff-workspace-right"]').trigger('click');
    await flushPromises();
    const filled = () =>
      (wrapper.findComponent(SourceDiffView).props('baseline') as SourceCorrelationModel).files[0]!.text;
    expect(filled()).toContain('int baseline()');

    await wrapper.find('[data-testid="compare-exit"]').trigger('click');
    await nextTick();
    // New bytes for that baseline: the directory pick no longer applies.
    await wrapper.setProps({ baselineReports: { 'b-1': { baselineId: 'b-1', report: missingPack() } } });
    await nextTick();
    await wrapper.find('[data-testid="compare-enter"]').trigger('click');
    await nextTick();
    expect(filled().startsWith(MISSING_SOURCE_EMBED_PREFIX)).toBe(true);
    expect(wrapper.find('[data-testid="source-diff-workspace-right"]').exists()).toBe(true);
    wrapper.unmount();
  });

  it('an implicit operator change replays the kept workspace pick', async () => {
    const current = correlationWith('/src/kernel.asc', 'int main() { return 0; }\n');
    const missing = (path: string) =>
      correlationWith(path, `${MISSING_SOURCE_EMBED_PREFIX}${path}\n`);
    const pack: AdaptedReport = {
      swimlaneModel: null,
      reportModel: { ...emptyReportViewModel(), sourceCorrelation: missing('/build/mm.asc') },
      operatorReports: {
        mm: {
          swimlaneModel: null,
          reportModel: { ...emptyReportViewModel(), sourceCorrelation: missing('/build/mm.asc') },
        },
        relu: {
          swimlaneModel: null,
          reportModel: { ...emptyReportViewModel(), sourceCorrelation: missing('/build/relu.asc') },
        },
      },
    };
    const pick = vi.fn(async () => ({
      // A directory pick returns every file it could resolve, not one name.
      files: [
        { path: 'mm.asc', text: 'int mm() {}' },
        { path: 'relu.asc', text: 'int relu() {}' },
      ],
    }));
    const wrapper = mount(ProfilingReport, {
      props: {
        title: 'workspace-implicit-operator',
        swimlaneModel: depsModel(),
        reportModel: { ...emptyReportViewModel(), sourceCorrelation: current },
        capabilities: ['sourceTab'],
        baselines: [{ id: 'b-1', name: '', path: '/data/a.rep' }],
        baselineRows: [{ id: 'brow-1', baselineId: 'b-1', operatorId: '' }],
        baselineReports: { 'b-1': { baselineId: 'b-1', report: pack } },
        pickSourceWorkspace: pick,
      },
    });
    await nextTick();
    await wrapper.find('[data-testid="tab-source"]').trigger('click');
    await nextTick();
    await wrapper.find('[data-testid="compare-enter"]').trigger('click');
    await nextTick();
    await wrapper.find('[data-testid="source-diff-workspace-right"]').trigger('click');
    await flushPromises();
    const filled = () =>
      (wrapper.findComponent(SourceDiffView).props('baseline') as SourceCorrelationModel).files[0]!.text;
    expect(filled()).toContain('int mm()');

    // The host row changes the operator without the select's handler.
    await wrapper.setProps({
      baselineRows: [{ id: 'brow-1', baselineId: 'b-1', operatorId: 'relu' }],
    });
    await flushPromises();
    expect(filled()).toContain('int relu()');
    wrapper.unmount();
  });

  it('a late resolve hook keeps the open report text a workspace pick supplied', async () => {
    const path = '/p/kernel.asc';
    const missing = correlationWith(path, `${MISSING_SOURCE_EMBED_PREFIX}${path}\n`);
    const pick = vi.fn(async () => ({
      files: [{ path: 'kernel.asc', text: 'int WORKSPACE() {}' }],
    }));
    const wrapper = mount(ProfilingReport, {
      props: {
        title: 'workspace-late-hook',
        swimlaneModel: depsModel(),
        reportModel: { ...emptyReportViewModel(), sourceCorrelation: missing },
        capabilities: ['sourceTab'],
        pickSourceWorkspace: pick,
      },
    });
    await nextTick();
    const vm = wrapper.vm as unknown as {
      onPickReportSourceWorkspace: () => Promise<void>;
      report: { sourceCorrelation: SourceCorrelationModel | null };
    };
    await vm.onPickReportSourceWorkspace();
    await flushPromises();
    expect(vm.report.sourceCorrelation!.files[0]!.text).toContain('WORKSPACE');

    const hook = vi.fn(async () => 'int HOOK() {}');
    await wrapper.setProps({ resolveSourceFile: hook });
    await flushPromises();
    expect(vm.report.sourceCorrelation!.files[0]!.text).toContain('WORKSPACE');
    wrapper.unmount();
  });

  it('a baseline pick survives a pack arrival while the dialog is open', async () => {
    const current = correlationWith('/src/kernel.asc', 'int main() { return 0; }\n');
    const pack = (): AdaptedReport => ({
      swimlaneModel: null,
      reportModel: {
        ...emptyReportViewModel(),
        sourceCorrelation: correlationWith(
          '/build/kernel.asc',
          `${MISSING_SOURCE_EMBED_PREFIX}/build/kernel.asc\n`,
        ),
      },
    });
    let openPick: (picked: { files: { path: string; text: string }[] }) => void = () => undefined;
    const pick = vi.fn(
      () =>
        new Promise<{ files: { path: string; text: string }[] }>((resolve) => {
          openPick = resolve;
        }),
    );
    const wrapper = mount(ProfilingReport, {
      props: {
        title: 'workspace-baseline-late-pack',
        swimlaneModel: depsModel(),
        reportModel: { ...emptyReportViewModel(), sourceCorrelation: current },
        capabilities: ['sourceTab'],
        baselines: [{ id: 'b-1', name: '', path: '/data/a.rep' }],
        baselineRows: [{ id: 'brow-1', baselineId: 'b-1', operatorId: '' }],
        baselineReports: { 'b-1': { baselineId: 'b-1', report: pack() } },
        pickSourceWorkspace: pick,
      },
    });
    await nextTick();
    await wrapper.find('[data-testid="tab-source"]').trigger('click');
    await nextTick();
    await wrapper.find('[data-testid="compare-enter"]').trigger('click');
    await nextTick();
    await wrapper.find('[data-testid="source-diff-workspace-right"]').trigger('click');
    await nextTick();
    // A new pack arrives mid-dialog and re-seeds the compare pair.
    await wrapper.setProps({ baselineReports: { 'b-1': { baselineId: 'b-1', report: pack() } } });
    await nextTick();
    openPick({ files: [{ path: 'kernel.asc', text: 'int PICKED() {}' }] });
    await flushPromises();
    const baseline = wrapper.findComponent(SourceDiffView).props('baseline') as SourceCorrelationModel;
    expect(baseline.files[0]!.text).toContain('PICKED');
    wrapper.unmount();
  });

  it('window Escape exits compare once and ignores an IME composition', async () => {
    const current = correlationWith('/src/kernel.asc', 'int main() { return 0; }\n');
    const baseline = correlationWith('/build/kernel.asc', 'int baseline() { return 1; }\n');
    const wrapper = mount(ProfilingReport, {
      props: {
        title: 'compare-escape',
        swimlaneModel: depsModel(),
        reportModel: { ...emptyReportViewModel(), sourceCorrelation: current },
        capabilities: ['sourceTab'],
        baselines: [{ id: 'b-1', name: '', path: '/data/a.rep' }],
        baselineRows: [{ id: 'brow-1', baselineId: 'b-1', operatorId: '' }],
        baselineReports: {
          'b-1': {
            baselineId: 'b-1',
            report: { swimlaneModel: null, reportModel: { ...emptyReportViewModel(), sourceCorrelation: baseline } },
          },
        },
      },
    });
    await nextTick();
    await wrapper.find('[data-testid="tab-source"]').trigger('click');
    await nextTick();
    await wrapper.find('[data-testid="compare-enter"]').trigger('click');
    await nextTick();
    expect(wrapper.findComponent(SourceDiffView).exists()).toBe(true);

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', isComposing: true }));
    await nextTick();
    expect(wrapper.findComponent(SourceDiffView).exists()).toBe(true);

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    await nextTick();
    expect(wrapper.findComponent(SourceDiffView).exists()).toBe(false);
    expect(wrapper.find('[data-testid="compare-enter"]').exists()).toBe(true);
    wrapper.unmount();
  });
});
