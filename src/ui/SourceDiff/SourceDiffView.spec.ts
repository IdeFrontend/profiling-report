import { describe, expect, it, vi } from 'vitest';
import { flushPromises, mount } from '@vue/test-utils';
import { nextTick } from 'vue';
import type { SourceCorrelationModel, SourceFileModel, SourceMetricsColumn } from '../../domain/types';
import SourceDiffPane from './SourceDiffPane.vue';
import SourceDiffView from './SourceDiffView.vue';

vi.mock('@sudu-ide/code-review', () => ({
  newWorkerPool: vi.fn(async () => ({ getNumThreads: () => 3 })),
  newTextModelFromLines: vi.fn(() => ({ dispose: vi.fn() })),
  newEditor: vi.fn(() => ({
    setModel: vi.fn(),
    setVScrollListener: vi.fn(),
    setVScrollVisible: vi.fn(),
    highlightRanges: vi.fn(),
    dispose: vi.fn(),
    getDevicePixelRatio: () => 1,
    getLineHeight: () => 18,
    getEditorHeight: () => 200,
    getMaxVScrollPos: () => 0,
    getNumLines: () => 10,
    getFontSize: () => 12,
    getFontFamily: () => 'monospace',
    getVScrollPos: () => 0,
    setVScrollPos: vi.fn(),
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
  it('PR-DIFF-201: Escape emits exit', async () => {
    const wrapper = await mountView();
    await wrapper.find('[data-testid="source-diff-view"]').trigger('keydown', { key: 'Escape' });
    expect(wrapper.emitted('exit')).toHaveLength(1);
    wrapper.unmount();
  });

  it('PR-DIFF-203: dock shows three tabs and two Source sub-panes', async () => {
    const wrapper = await mountView();
    expect(wrapper.find('[data-testid="source-diff-tab-inline"]').text()).toBe('Inline Functions');
    expect(wrapper.find('[data-testid="source-diff-tab-markers"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="source-diff-tab-stats"]').exists()).toBe(true);
    await wrapper.find('[data-testid="source-diff-tab-stats"]').trigger('click');
    expect(
      wrapper.find('[data-testid="source-diff-tab-stats"]').attributes('aria-selected'),
    ).toBe('true');
    expect(wrapper.findAll('section').length).toBeGreaterThanOrEqual(2);
    wrapper.unmount();
  });

  it('PR-DIFF-206: each dock tab renders its own content and inline names come from the source', async () => {
    const wrapper = await mountView(
      ['__aicore__ inline void HwdefectFind(int a) {', '}'].join('\n'),
      ['__aicore__ inline void CopyIn(int a) {', '}'].join('\n'),
    );
    const left = () => wrapper.find('[data-testid="source-diff-dock-left-content"]').text();
    const right = () => wrapper.find('[data-testid="source-diff-dock-right-content"]').text();

    expect(left()).toBe('HwdefectFind');
    expect(right()).toBe('CopyIn');

    await wrapper.find('[data-testid="source-diff-tab-markers"]').trigger('click');
    expect(left()).toContain('Source Markers');
    expect(left()).not.toContain('HwdefectFind');

    await wrapper.find('[data-testid="source-diff-tab-stats"]').trigger('click');
    expect(left()).toContain('Statistics');
    expect(right()).toContain('Statistics');

    expect(wrapper.findAll('section')).toHaveLength(2);
    wrapper.unmount();
  });

  it('PR-DIFF-208: the dock toggle hides and restores the panes', async () => {
    const wrapper = await mountView();
    const toggle = wrapper.find('[data-testid="source-diff-dock-toggle"]');
    expect(toggle.attributes('aria-expanded')).toBe('true');
    expect(wrapper.find('[data-testid="source-diff-dock-left"]').isVisible()).toBe(true);

    await toggle.trigger('click');
    expect(toggle.attributes('aria-expanded')).toBe('false');
    expect(wrapper.find('[data-testid="source-diff-dock-left"]').isVisible()).toBe(false);
    expect(wrapper.find('[data-testid="source-diff-tab-inline"]').isVisible()).toBe(true);

    await toggle.trigger('click');
    expect(toggle.attributes('aria-expanded')).toBe('true');
    expect(wrapper.find('[data-testid="source-diff-dock-left"]').isVisible()).toBe(true);
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
