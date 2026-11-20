import { beforeEach, describe, expect, it, vi } from 'vitest';
import { flushPromises, mount } from '@vue/test-utils';
import { nextTick } from 'vue';
import type { SourceFileModel } from '../../domain/types';
import SourceDiffPane from './SourceDiffPane.vue';
import type { DiffRow } from './diffAlign';

const sudu = vi.hoisted(() => ({ modelLines: [] as unknown[][] }));

vi.mock('@sudu-ide/code-review', () => ({
  newWorkerPool: vi.fn(async () => ({ getNumThreads: () => 3 })),
  newTextModelFromLines: vi.fn(
    (_workers: unknown, lines: unknown[], _language?: string, _uri?: unknown) => {
      sudu.modelLines.push(lines);
      return { dispose: vi.fn() };
    },
  ),
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

const metrics: SourceFileModel = {
  id: 'f1',
  path: '/tmp/demo.asc',
  language: 'ascend-c',
  text: 'a\nb\nc',
  metricsColumns: [{ id: 'cycles', label: 'Cycles', kind: 'number' }],
  lines: [
    { line: 1, values: { cycles: 10 } },
    { line: 7, values: { cycles: 70 } },
  ],
};

function row(over: Partial<DiffRow>): DiffRow {
  return { kind: 'same', leftLine: null, rightLine: null, leftText: '', rightText: '', ...over };
}

async function mountPane(rows: DiffRow[], side: 'left' | 'right') {
  const wrapper = mount(SourceDiffPane, {
    props: { rows, side, metrics, locale: 'en-US' },
    attachTo: document.body,
  });
  await flushPromises();
  await nextTick();
  await new Promise((resolve) => requestAnimationFrame(resolve));
  await nextTick();
  return wrapper;
}

describe('SourceDiffPane', () => {
  beforeEach(() => {
    sudu.modelLines.length = 0;
  });

  it('PR-DIFF-101: changed rows tint both panes yellow', async () => {
    const rows = [row({ kind: 'same', leftLine: 1, rightLine: 1 }), row({ kind: 'changed', leftLine: 2, rightLine: 2 })];
    for (const side of ['left', 'right'] as const) {
      const wrapper = await mountPane(rows, side);
      const tints = wrapper.findAll('[data-row-tint]');
      expect(tints).toHaveLength(2);
      expect(tints.map((tint) => tint.attributes('data-row-tint'))).toEqual([
        'changed',
        'changed-metrics',
      ]);
      wrapper.unmount();
    }
  });

  it('PR-DIFF-102: only-left is brown on the left pane and untinted on the right pane', async () => {
    const rows = [row({ kind: 'onlyLeft', leftLine: 4, rightLine: null, leftText: 'x' })];
    const left = await mountPane(rows, 'left');
    expect(left.find('[data-row-tint]').attributes('data-row-tint')).toBe('only');
    left.unmount();
    const right = await mountPane(rows, 'right');
    expect(right.findAll('[data-row-tint]')).toHaveLength(0);
    right.unmount();
  });

  it('PR-DIFF-104: header row labels #, Source and every metric column', async () => {
    const wrapper = await mountPane([row({ kind: 'same', leftLine: 1, rightLine: 1 })], 'left');
    const labels = wrapper
      .findAll('[data-testid="source-diff-head"] th')
      .map((th) => th.text());
    expect(labels).toEqual(['#', 'Source', 'Cycles']);
    wrapper.unmount();
  });

  it('PR-DIFF-105: the tint band originates in the pane body, not the editor host', async () => {
    const wrapper = await mountPane([row({ kind: 'changed', leftLine: 1, rightLine: 1 })], 'left');
    expect(wrapper.find('.pr-src-diff-pane__body > .pr-src-diff-pane__tint').exists()).toBe(true);
    expect(wrapper.find('.pr-src-diff-pane__editor .pr-src-diff-pane__tint').exists()).toBe(false);
    wrapper.unmount();
  });

  it('PR-DIFF-106: each pane is a region named for its side', async () => {
    const left = await mountPane([], 'left');
    expect(left.attributes('role')).toBe('region');
    expect(left.attributes('aria-label')).toBe('Left source pane');
    left.unmount();
    const right = await mountPane([], 'right');
    expect(right.attributes('aria-label')).toBe('Right source pane');
    right.unmount();
  });

  it('PR-DIFF-103: gutter numbers follow source lines and skip filler rows', async () => {
    const rows = [
      row({ kind: 'same', leftLine: 1, rightLine: 1, leftText: 'a', rightText: 'a' }),
      row({ kind: 'changed', leftLine: 7, rightLine: null, leftText: 'b', rightText: '' }),
    ];
    const wrapper = await mountPane(rows, 'left');
    const leftLines = sudu.modelLines.at(-1) as {
      lineNumber?: number;
      tokens: { text: string }[];
    }[];
    expect(leftLines[0]).toEqual({ lineNumber: 1, tokens: [{ text: 'a' }] });
    expect(leftLines[1]).toEqual({ lineNumber: 7, tokens: [{ text: 'b' }] });
    wrapper.unmount();

    const rightWrapper = await mountPane(rows, 'right');
    const rightLines = sudu.modelLines.at(-1) as { lineNumber?: number }[];
    expect(rightLines[0]!.lineNumber).toBe(1);
    expect('lineNumber' in rightLines[1]!).toBe(false);
    rightWrapper.unmount();
  });
});
