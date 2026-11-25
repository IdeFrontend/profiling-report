import { beforeEach, describe, expect, it, vi } from 'vitest';
import { flushPromises, mount } from '@vue/test-utils';
import { nextTick } from 'vue';
import type { SourceCorrelationModel, SourceFileModel, SourceMetricsColumn } from '../../domain/types';
import SourceDiffPane from './SourceDiffPane.vue';
import SourceDiffView from './SourceDiffView.vue';

const sudu = vi.hoisted(() => ({
  pool: { getNumThreads: () => 3 },
  diffModels: [] as { dispose: ReturnType<typeof vi.fn> }[],
  sides: [] as boolean[],
  views: [] as { setModel: ReturnType<typeof vi.fn> }[],
}));

vi.mock('@sudu-ide/code-review', () => ({
  newWorkerPool: vi.fn(async () => sudu.pool),
  newDiffModel: vi.fn(() => {
    const model = { dispose: vi.fn() };
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
    sudu.sides.length = 0;
    sudu.views.length = 0;
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

  it('PR-DIFF-207: Navigate By highlights one shared metric; the link toggle drives pane sync state', async () => {
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

    const link = wrapper.find('[data-testid="source-diff-link-left"]');
    expect(link.attributes('aria-pressed')).toBe('true');
    await link.trigger('click');
    expect(panes[0]!.props('linked')).toBe(false);
    expect(panes[1]!.props('linked')).toBe(false);
    expect(link.attributes('aria-pressed')).toBe('false');
    await link.trigger('click');
    expect(panes[0]!.props('linked')).toBe(true);
    wrapper.unmount();
  });
});
