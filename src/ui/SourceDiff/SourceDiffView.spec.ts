import { beforeEach, describe, expect, it, vi } from 'vitest';
import { flushPromises, mount } from '@vue/test-utils';
import { nextTick } from 'vue';
import type { SourceCorrelationModel, SourceFileModel, SourceMetricsColumn } from '../../domain/types';
import { t } from '../../i18n';
import SourceDiffPane from './SourceDiffPane.vue';
import SourceDiffView from './SourceDiffView.vue';

const sudu = vi.hoisted(() => ({
  pool: { getNumThreads: () => 3 },
  diffModels: [] as {
    dispose: ReturnType<typeof vi.fn>;
    getLinesInfo: () => Promise<unknown>;
    $javaModel0: { $diffModel0: { $ranges: { data: unknown[] } } };
  }[],
  ranges: [] as { $fromL: number; $lenL: number; $fromR: number; $lenR: number }[],
  sides: [] as boolean[],
  views: [] as { setModel: ReturnType<typeof vi.fn> }[],
}));

vi.mock('@sudu-ide/code-review', () => ({
  newWorkerPool: vi.fn(async () => sudu.pool),
  newDiffModel: vi.fn(() => {
    const model = {
      dispose: vi.fn(),
      getLinesInfo: () => Promise.resolve({}),
      $javaModel0: { $diffModel0: { $ranges: { data: sudu.ranges } } },
    };
    sudu.diffModels.push(model);
    return model;
  }),
  newSideDiff: vi.fn((_args: unknown, left: boolean) => {
    sudu.sides.push(left);
    const view = { setModel: vi.fn(), setVScrollListener: vi.fn(), setVScrollPos: vi.fn(), dispose: vi.fn() };
    sudu.views.push(view);
    return view;
  }),
  // Measurement-only editor: the pane never attaches or scrolls it.
  newEditor: vi.fn(() => ({
    dispose: vi.fn(),
    getDevicePixelRatio: () => 1,
    getLineHeight: () => 18,
    getFontSize: () => 12,
    getFontFamily: () => 'monospace',
  })),
}));

function file(id: string, text: string, metricsColumns: SourceMetricsColumn[] = []): SourceFileModel {
  return {
    id,
    path: `/tmp/${id}.asc`,
    language: 'ascend-c',
    text,
    metricsColumns,
    lines: [],
  };
}

function correlation(files: SourceFileModel[]): SourceCorrelationModel {
  return {
    files,
    assembly: file('asm', ''),
    asmToSource: new Map(),
    navigateBy: [],
    mock: false,
  };
}

const LEFT_LINES = ['l1', 'l2', 'l3', 'l4', 'l5', 'l6', 'l7', 'l8', 'l9', 'l10'];
const RIGHT_LINES = ['l1', 'l2', 'l3', 'CHANGED', 'l5', 'l6', 'l7', 'l8', 'l9', 'l10'];

async function mountView(leftText = LEFT_LINES.join('\n'), rightText = RIGHT_LINES.join('\n')) {
  const wrapper = mount(SourceDiffView, {
    props: {
      current: correlation([file('cur', leftText)]),
      baseline: correlation([file('cur', rightText)]),
      locale: 'en-US',
    },
    attachTo: document.body,
  });
  await flushPromises();
  await nextTick();
  return wrapper;
}

describe('SourceDiffView', () => {
  beforeEach(() => {
    sudu.diffModels.length = 0;
    sudu.ranges.length = 0;
    sudu.sides.length = 0;
    sudu.views.length = 0;
  });

  it('rows follow the library ranges once the worker diff lands', async () => {
    sudu.ranges.push(
      { $fromL: 0, $lenL: 1, $fromR: 0, $lenR: 1 },
      { $fromL: 1, $lenL: 2, $fromR: 1, $lenR: 1 },
    );
    const wrapper = mount(SourceDiffView, {
      props: {
        current: correlation([file('cur', 'a\nb\nc')]),
        baseline: correlation([file('cur', 'a\nc')]),
        locale: 'en-US',
      },
      attachTo: document.body,
    });
    await flushPromises();
    await nextTick();
    const rows = wrapper.findAllComponents(SourceDiffPane)[0]!.props('rows') as { kind: string }[];
    // The LCS would pair 'b' with nothing and keep 'c' same; the library hunks win.
    expect(rows.map((row) => row.kind)).toEqual(['same', 'changed', 'onlyLeft']);
    wrapper.unmount();
  });

  it('PR-DIFF-210: both panes share one diff model, rebuilt and disposed on text change', async () => {
    const wrapper = await mountView();
    expect(sudu.sides).toEqual([true, false]);
    const model = sudu.diffModels.at(-1)!;
    const panes = wrapper.findAllComponents(SourceDiffPane);
    expect(panes[0]!.props('diffModel')).toBe(model);
    expect(panes[1]!.props('diffModel')).toBe(model);
    expect(sudu.views[0]!.setModel).toHaveBeenLastCalledWith(model);
    expect(sudu.views[1]!.setModel).toHaveBeenLastCalledWith(model);
    expect(wrapper.find('[data-row-tint]').exists()).toBe(false);

    await wrapper.setProps({ current: correlation([file('cur', 'x\ny')]) });
    await flushPromises();
    await nextTick();
    await nextTick();
    const next = sudu.diffModels.at(-1)!;
    expect(next).not.toBe(model);
    expect(panes[0]!.props('diffModel')).toBe(next);
    expect(panes[1]!.props('diffModel')).toBe(next);
    expect(sudu.views[0]!.setModel).toHaveBeenLastCalledWith(next);
    expect(sudu.views[1]!.setModel).toHaveBeenLastCalledWith(next);
    expect(model.dispose).toHaveBeenCalled();

    wrapper.unmount();
    expect(next.dispose).toHaveBeenCalled();
  });

  it('PR-DIFF-201: Escape emits exit', async () => {
    const wrapper = await mountView();
    await wrapper.find('[data-testid="source-diff-view"]').trigger('keydown', { key: 'Escape' });
    expect(wrapper.emitted('exit')).toHaveLength(1);
    wrapper.unmount();
  });

  it('PR-DIFF-203: the bottom dock is gone', async () => {
    const wrapper = await mountView();
    expect(wrapper.find('[role="tablist"]').exists()).toBe(false);
    expect(wrapper.find('[data-testid^="source-diff-tab-"]').exists()).toBe(false);
    expect(wrapper.find('[data-testid="source-diff-dock-toggle"]').exists()).toBe(false);
    wrapper.unmount();
  });

  it('PR-DIFF-109: a pointerdown moves the focus ring to the pressed pane', async () => {
    const wrapper = await mountView();
    const focused = () => wrapper.findAll('.pr-src-diff-pane__surface--focused');
    expect(focused()).toHaveLength(1);
    expect(
      wrapper.find('[data-testid="source-diff-pane-left"] .pr-src-diff-pane__surface--focused').exists(),
    ).toBe(true);

    await wrapper.find('[data-testid="source-diff-pane-host-right"]').trigger('pointerdown');
    await nextTick();
    expect(focused()).toHaveLength(1);
    expect(
      wrapper.find('[data-testid="source-diff-pane-right"] .pr-src-diff-pane__surface--focused').exists(),
    ).toBe(true);
    wrapper.unmount();
  });

  it('PR-DIFF-207: Navigate By highlights one shared metric; scroll sync is always on', async () => {
    const columns: SourceMetricsColumn[] = [
      { id: 'instructionsExecuted', label: 'Instructions Executed', kind: 'bar' },
      { id: 'samplingStall', label: 'Sampling Stall', kind: 'bar' },
    ];
    const wrapper = mount(SourceDiffView, {
      props: {
        current: correlation([file('cur', LEFT_LINES.join('\n'), columns)]),
        baseline: correlation([file('cur', RIGHT_LINES.join('\n'), columns)]),
        locale: 'en-US',
      },
      attachTo: document.body,
    });
    await flushPromises();
    await nextTick();
    const panes = wrapper.findAllComponents(SourceDiffPane);
    expect(panes[0]!.props('highlightColumn')).toBe('instructionsExecuted');
    expect(panes[1]!.props('highlightColumn')).toBe('instructionsExecuted');

    panes[1]!.vm.$emit('update:navigateBy', 'samplingStall');
    await nextTick();
    expect(panes[0]!.props('highlightColumn')).toBe('samplingStall');
    expect(panes[1]!.props('highlightColumn')).toBe('samplingStall');

    expect(wrapper.find('[data-testid="source-diff-link-left"]').exists()).toBe(false);
    expect(wrapper.find('[data-testid="source-diff-link-right"]').exists()).toBe(false);

    type ScrollPane = { setScrollCss: (css: number) => void };
    const rightSetScroll = vi.spyOn(panes[1]!.vm.$.exposed as unknown as ScrollPane, 'setScrollCss');
    const leftSetScroll = vi.spyOn(panes[0]!.vm.$.exposed as unknown as ScrollPane, 'setScrollCss');
    const leftListener = panes[0]!.props('scrollListener') as (css: number) => void;
    const rightListener = panes[1]!.props('scrollListener') as (css: number) => void;
    leftListener(126);
    expect(rightSetScroll).toHaveBeenLastCalledWith(126);
    rightListener(54);
    expect(leftSetScroll).toHaveBeenLastCalledWith(54);
    wrapper.unmount();
  });

  it('PR-DIFF-212: disjoint file paths still pair the panes through the first-file fallback', async () => {
    const wrapper = mount(SourceDiffView, {
      props: {
        current: correlation([file('left-only', LEFT_LINES.join('\n'))]),
        baseline: correlation([file('right-only', RIGHT_LINES.join('\n'))]),
        locale: 'en-US',
      },
      attachTo: document.body,
    });
    await flushPromises();
    await nextTick();
    const panes = wrapper.findAllComponents(SourceDiffPane);
    expect(panes).toHaveLength(2);
    expect((panes[0]!.props('metrics') as SourceFileModel).id).toBe('left-only');
    expect((panes[1]!.props('metrics') as SourceFileModel).id).toBe('right-only');
    expect(sudu.diffModels).toHaveLength(1);
    wrapper.unmount();
  });

  it('PR-DIFF-213: each pane forwards its own workspace availability and emit', async () => {
    const wrapper = mount(SourceDiffView, {
      props: {
        current: correlation([file('cur', LEFT_LINES.join('\n'))]),
        baseline: correlation([file('cur', RIGHT_LINES.join('\n'))]),
        locale: 'en-US',
        currentWorkspaceAvailable: true,
      },
      attachTo: document.body,
    });
    await flushPromises();
    await nextTick();
    const panes = wrapper.findAllComponents(SourceDiffPane);
    expect(panes[0]!.props('workspaceAvailable')).toBe(true);
    expect(panes[1]!.props('workspaceAvailable')).toBe(false);
    expect(panes[0]!.props('workspaceTitle')).toBe(t('sourceWorkspacePick', 'en-US'));
    expect(panes[1]!.props('workspaceTitle')).toBe(t('sourceWorkspaceBaselinePick', 'en-US'));
    panes[0]!.vm.$emit('pick-workspace');
    panes[1]!.vm.$emit('pick-workspace');
    expect(wrapper.emitted('pick-current-workspace')).toHaveLength(1);
    expect(wrapper.emitted('pick-baseline-workspace')).toHaveLength(1);
    wrapper.unmount();
  });

  it('PR-DIFF-216: a missing baseline renders the left pane and an explicit empty right pane', async () => {
    const wrapper = mount(SourceDiffView, {
      props: {
        current: correlation([file('cur', LEFT_LINES.join('\n'))]),
        locale: 'en-US',
      },
      attachTo: document.body,
    });
    await flushPromises();
    await nextTick();
    expect(wrapper.find('[data-testid="source-diff-pane-left"]').exists()).toBe(true);
    const empty = wrapper.get('[data-testid="source-diff-baseline-empty"]');
    expect(empty.text()).toBe(t('sourceDiffBaselineEmpty', 'en-US'));
    expect(wrapper.find('[data-testid="source-diff-workspace-right"]').exists()).toBe(false);
    // A missing baseline must not paint the open report as removed.
    const rows = wrapper.findAllComponents(SourceDiffPane)[0]!.props('rows') as { kind: string }[];
    expect(rows).toHaveLength(LEFT_LINES.length);
    expect(rows.every((row) => row.kind === 'same')).toBe(true);
    wrapper.unmount();
  });

  it('PR-DIFF-217: an empty baseline with a workspace hook shows a disabled right workspace button', async () => {
    const wrapper = mount(SourceDiffView, {
      props: {
        current: correlation([file('cur', LEFT_LINES.join('\n'))]),
        baseline: correlation([]),
        locale: 'en-US',
        baselineWorkspaceAvailable: true,
      },
      attachTo: document.body,
    });
    await flushPromises();
    await nextTick();
    expect(wrapper.find('[data-testid="source-diff-pane-left"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="source-diff-baseline-empty"]').exists()).toBe(true);
    const rows = wrapper.findAllComponents(SourceDiffPane)[0]!.props('rows') as { kind: string }[];
    expect(rows.every((row) => row.kind === 'same')).toBe(true);
    const button = wrapper.get('[data-testid="source-diff-workspace-right"]');
    expect(button.attributes('disabled')).toBeDefined();
    expect(button.attributes('title')).toBe(t('sourceDiffWorkspaceBaselineDisabled', 'en-US'));
    wrapper.unmount();
  });

  it('PR-DIFF-201: window Escape exits before the view is focused, and mount focuses the view', async () => {
    const wrapper = await mountView();
    const root = wrapper.get('[data-testid="source-diff-view"]').element as HTMLElement;
    expect(document.activeElement).toBe(root);
    root.blur();
    const swallowed = new KeyboardEvent('keydown', { key: 'Escape', cancelable: true });
    swallowed.preventDefault();
    window.dispatchEvent(swallowed);
    expect(wrapper.emitted('exit')).toBeUndefined();
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(wrapper.emitted('exit')).toHaveLength(1);
    wrapper.unmount();
  });

  it('a new baseline file set keeps the file the user picked', async () => {
    const current = correlation([file('a', 'alpha'), file('b', 'beta')]);
    const baseline = correlation([file('a', 'ALPHA'), file('b', 'BETA')]);
    const wrapper = mount(SourceDiffView, {
      props: { current, baseline, locale: 'en-US' },
      attachTo: document.body,
    });
    await flushPromises();
    const panes = () => wrapper.findAllComponents(SourceDiffPane);
    panes()[0]!.vm.$emit('select-file', 'b');
    await nextTick();
    expect((panes()[0]!.props('metrics') as SourceFileModel).id).toBe('b');

    await wrapper.setProps({
      baseline: correlation([file('a', 'ALPHA'), file('b', 'BETA'), file('c', 'GAMMA')]),
    });
    await nextTick();
    expect((panes()[0]!.props('metrics') as SourceFileModel).id).toBe('b');
    expect((panes()[1]!.props('metrics') as SourceFileModel).id).toBe('b');
    wrapper.unmount();
  });

  it('PR-DIFF-218: a file pick pairs the other pane by path and survives a same-file overlay', async () => {
    const leftA = file('a', 'alpha');
    const leftB = file('b', 'beta');
    const rightA = file('a', 'ALPHA');
    const rightB = file('b', 'BETA');
    const current = correlation([leftA, leftB]);
    const baseline = correlation([rightA, rightB]);
    const wrapper = mount(SourceDiffView, {
      props: { current, baseline, locale: 'en-US' },
      attachTo: document.body,
    });
    await flushPromises();
    const panes = () => wrapper.findAllComponents(SourceDiffPane);
    panes()[0]!.vm.$emit('select-file', 'b');
    await nextTick();
    expect((panes()[0]!.props('metrics') as SourceFileModel).id).toBe('b');
    expect((panes()[1]!.props('metrics') as SourceFileModel).id).toBe('b');

    panes()[1]!.vm.$emit('select-file', 'a');
    await nextTick();
    expect((panes()[0]!.props('metrics') as SourceFileModel).id).toBe('a');
    expect((panes()[1]!.props('metrics') as SourceFileModel).id).toBe('a');

    panes()[0]!.vm.$emit('select-file', 'b');
    await nextTick();
    await wrapper.setProps({
      current: { ...current, files: [{ ...leftA }, { ...leftB, text: 'beta changed' }] },
    });
    await nextTick();
    expect((panes()[0]!.props('metrics') as SourceFileModel).id).toBe('b');
    expect((panes()[1]!.props('metrics') as SourceFileModel).id).toBe('b');
    wrapper.unmount();
  });

  it('PR-DIFF-219: search and Navigate By follow the focused pane, and search keeps its own cursor', async () => {
    const columns: SourceMetricsColumn[] = [{ id: 'cycles', label: 'Cycles', kind: 'number' }];
    const left = file('cur', 'keep\nkeep\nkeep', columns);
    left.lines = [
      { line: 1, values: { cycles: 1 } },
      { line: 2, values: { cycles: 1 } },
      { line: 3, values: { cycles: 1 } },
    ];
    const right = file('cur', 'right-only\nkeep\nkeep', columns);
    right.lines = [
      { line: 1, values: { cycles: 0 } },
      { line: 2, values: { cycles: 4 } },
      { line: 3, values: { cycles: 8 } },
    ];
    const wrapper = mount(SourceDiffView, {
      props: {
        current: correlation([left]),
        baseline: correlation([right]),
        locale: 'en-US',
        searchQuery: 'right-only',
      },
      attachTo: document.body,
    });
    await flushPromises();
    const panes = wrapper.findAllComponents(SourceDiffPane);
    const rightScroll = vi.spyOn(panes[1]!.vm.$.exposed as { scrollToRow: (index: number) => void }, 'scrollToRow');
    const vm = wrapper.vm as unknown as {
      findNext: () => void;
      findSearch: (dir: 1 | -1) => void;
    };

    vm.findSearch(1);
    expect(rightScroll).not.toHaveBeenCalled();

    await wrapper.find('[data-testid="source-diff-pane-host-right"]').trigger('pointerdown');
    vm.findNext();
    expect(rightScroll).toHaveBeenLastCalledWith(1);

    rightScroll.mockClear();
    vm.findSearch(1);
    expect(rightScroll).toHaveBeenLastCalledWith(0);

    rightScroll.mockClear();
    vm.findNext();
    expect(rightScroll).toHaveBeenLastCalledWith(2);
    wrapper.unmount();
  });

  it('an empty right pane does not steal search or Navigate By', async () => {
    const columns: SourceMetricsColumn[] = [{ id: 'cycles', label: 'Cycles', kind: 'number' }];
    const left = file('cur', 'keep\nkeep', columns);
    left.lines = [
      { line: 1, values: { cycles: 3 } },
      { line: 2, values: { cycles: 0 } },
    ];
    const wrapper = mount(SourceDiffView, {
      props: { current: correlation([left]), locale: 'en-US' },
      attachTo: document.body,
    });
    await flushPromises();
    const leftScroll = vi.spyOn(
      wrapper.findAllComponents(SourceDiffPane)[0]!.vm.$.exposed as { scrollToRow: (index: number) => void },
      'scrollToRow',
    );
    await wrapper.find('[data-testid="source-diff-pane-host-right"]').trigger('pointerdown');
    expect(
      wrapper.find('[data-testid="source-diff-pane-left"] .pr-src-diff-pane__surface--focused').exists(),
    ).toBe(true);
    (wrapper.vm as unknown as { findNext: () => void }).findNext();
    expect(leftScroll).toHaveBeenCalledWith(0);
    wrapper.unmount();
  });

  it('the focused pane snaps Navigate By onto a column it actually has', async () => {
    const left = file('cur', 'a\nb', [{ id: 'instructionsExecuted', label: 'Instructions', kind: 'number' }]);
    const right = file('cur', 'a\nb', [{ id: 'relTime', label: 'Rel Time', kind: 'number' }]);
    const wrapper = mount(SourceDiffView, {
      props: {
        current: correlation([left]),
        baseline: correlation([right]),
        locale: 'en-US',
      },
      attachTo: document.body,
    });
    await flushPromises();
    await nextTick();
    const panes = () => wrapper.findAllComponents(SourceDiffPane);
    expect(panes()[0]!.props('highlightColumn')).toBe('instructionsExecuted');
    await wrapper.find('[data-testid="source-diff-pane-host-right"]').trigger('pointerdown');
    await nextTick();
    expect(panes()[0]!.props('highlightColumn')).toBe('relTime');
    expect(panes()[1]!.props('highlightColumn')).toBe('relTime');
    wrapper.unmount();
  });
});
