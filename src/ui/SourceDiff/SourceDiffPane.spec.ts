import { beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { flushPromises, mount } from '@vue/test-utils';
import { nextTick } from 'vue';
import type { ITextDiffModel } from '@sudu-ide/code-review';
import type { SourceFileModel } from '../../domain/types';
import SourceDiffPane from './SourceDiffPane.vue';
import type { DiffRow } from './diffAlign';

// Row separators and the plane divider are CSS contracts; unit tests inject no SFC styles.
const paneSrc = readFileSync(resolve(__dirname, 'SourceDiffPane.vue'), 'utf8');
const tableSrc = readFileSync(resolve(__dirname, '../SourceView/SourceMetricsTable.vue'), 'utf8');

const sudu = vi.hoisted(() => ({
  pool: { getNumThreads: () => 3 },
  dpr: 1,
  args: [] as Record<string, unknown>[],
  diffModel: { dispose: vi.fn() } as unknown as ITextDiffModel & {
    dispose: ReturnType<typeof vi.fn>;
  },
  sides: [] as boolean[],
  views: [] as {
    setModel: ReturnType<typeof vi.fn>;
    setVScrollListener: ReturnType<typeof vi.fn>;
    setVScrollPos: ReturnType<typeof vi.fn>;
    dispose: ReturnType<typeof vi.fn>;
  }[],
}));

vi.mock('@sudu-ide/code-review', () => ({
  newWorkerPool: vi.fn(async () => sudu.pool),
  newDiffModel: vi.fn(() => sudu.diffModel),
  newSideDiff: vi.fn((args: Record<string, unknown>, left: boolean) => {
    sudu.args.push(args);
    sudu.sides.push(left);
    const view = {
      setModel: vi.fn(),
      setVScrollListener: vi.fn(),
      setVScrollPos: vi.fn(),
      dispose: vi.fn(),
    };
    sudu.views.push(view);
    return view;
  }),
  // Measurement-only editor: the pane never attaches or scrolls it.
  newEditor: vi.fn(() => ({
    dispose: vi.fn(),
    getDevicePixelRatio: () => sudu.dpr,
    getLineHeight: () => 18,
    getFontSize: () => 12 * sudu.dpr,
    getFontFamily: () => 'monospace',
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

async function mountPane(rows: DiffRow[], side: 'left' | 'right', file: SourceFileModel = metrics) {
  const wrapper = mount(SourceDiffPane, {
    props: { rows, side, metrics: file, locale: 'en-US', diffModel: sudu.diffModel, workers: sudu.pool },
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
    sudu.sides.length = 0;
    sudu.views.length = 0;
    sudu.args.length = 0;
  });

  it('PR-DIFF-101: each pane renders the shared model through native SideDiff', async () => {
    const rows = [row({ kind: 'same', leftLine: 1, rightLine: 1 }), row({ kind: 'changed', leftLine: 2, rightLine: 2 })];
    for (const side of ['left', 'right'] as const) {
      const wrapper = await mountPane(rows, side);
      const index = sudu.sides.length - 1;
      expect(sudu.sides[index]).toBe(side === 'left');
      expect(sudu.views[index]!.setModel).toHaveBeenCalledWith(sudu.diffModel);
      // Sudu paints the change regions itself; no overlay is rendered.
      expect(wrapper.find('[data-row-tint]').exists()).toBe(false);
      expect(wrapper.find('.pr-src-diff-pane__tint').exists()).toBe(false);
      wrapper.unmount();
    }
  });

  it('PR-DIFF-102: a one-sided row still feeds both panes their native diff model', async () => {
    const rows = [row({ kind: 'onlyLeft', leftLine: 4, rightLine: null, leftText: 'x' })];
    for (const side of ['left', 'right'] as const) {
      const wrapper = await mountPane(rows, side);
      const index = sudu.sides.length - 1;
      expect(sudu.sides[index]).toBe(side === 'left');
      expect(sudu.views[index]!.setModel).toHaveBeenCalledWith(sudu.diffModel);
      expect(wrapper.find('[data-row-tint]').exists()).toBe(false);
      wrapper.unmount();
    }
  });

  it('PR-DIFF-108: no element in the code plane paints a repeating-linear-gradient', async () => {
    const rows = [
      row({ kind: 'onlyLeft', leftLine: 4, rightLine: null, leftText: 'x' }),
      row({ kind: 'onlyRight', leftLine: null, rightLine: 5, rightText: 'y' }),
      row({ kind: 'changed', leftLine: 6, rightLine: 6, leftText: 'a', rightText: 'b' }),
    ];
    for (const side of ['left', 'right'] as const) {
      const wrapper = await mountPane(rows, side);
      // Code plane = the editor host and its descendants.
      // Metric cells are out of scope: their occupancy hatch stays.
      const codePlane = [
        ...wrapper.findAll('.pr-src-diff-pane__editor'),
        ...wrapper.findAll('.pr-src-diff-pane__editor *'),
      ];
      expect(codePlane.length).toBeGreaterThan(0);
      const hatched = codePlane.filter((el) =>
        window.getComputedStyle(el.element).backgroundImage.includes('repeating-linear-gradient'),
      );
      expect(hatched).toEqual([]);
      wrapper.unmount();
    }
  });

  it('PR-DIFF-109: a row this side lacks renders no occupancy capsule', async () => {
    const barMetrics: SourceFileModel = {
      ...metrics,
      metricsColumns: [{ id: 'warpOccupancy', label: 'Warp Occupancy', kind: 'bar' }],
      lines: [{ line: 1, values: { warpOccupancy: 0.5 } }],
    };
    const rows = [
      row({ kind: 'same', leftLine: 1, rightLine: 1, leftText: 'a', rightText: 'a' }),
      row({ kind: 'onlyLeft', leftLine: 2, rightLine: null, leftText: 'b' }),
    ];
    const wrapper = mount(SourceDiffPane, {
      props: { rows, side: 'right', metrics: barMetrics, locale: 'en-US' },
      attachTo: document.body,
    });
    await flushPromises();
    await nextTick();
    expect(wrapper.findAll('tr[data-line="1"] .pr-src-metrics__bar-track')).toHaveLength(1);
    const blank = wrapper.get('tr[data-line="2"]');
    expect(blank.classes()).toContain('pr-src-metrics__row--blank');
    expect(blank.find('.pr-src-metrics__bar-track').exists()).toBe(false);
    expect(blank.get('[data-col="warpOccupancy"]').text()).toBe('');
    wrapper.unmount();
  });

  it('PR-DIFF-107: a row this side lacks paints no overlay and leaves its metrics cell blank', async () => {
    const rows = [row({ kind: 'onlyRight', leftLine: null, rightLine: 5, rightText: 'y' })];
    const wrapper = await mountPane(rows, 'left');
    expect(wrapper.find('[data-row-tint]').exists()).toBe(false);
    // The missing line comes from the native model as a spacer, never an invented row.
    expect(sudu.views.at(-1)!.setModel).toHaveBeenCalledWith(sudu.diffModel);
    const blank = wrapper.get('tr[data-line="1"]');
    expect(blank.classes()).toContain('pr-src-metrics__row--blank');
    expect(blank.get('[data-col="cycles"]').text()).toBe('');
    wrapper.unmount();
  });

  it('PR-DIFF-104: header row labels #, Source and every metric column', async () => {
    const wrapper = await mountPane([row({ kind: 'same', leftLine: 1, rightLine: 1 })], 'left');
    const labels = wrapper
      .findAll('[data-testid="source-diff-head"] th')
      .map((th) => th.text());
    expect(labels).toEqual(['#', 'Source', 'Cycles']);
    wrapper.unmount();
  });

  it('PR-DIFF-105: no tint overlay renders; native SideDiff paints row backgrounds', async () => {
    const wrapper = await mountPane([row({ kind: 'changed', leftLine: 1, rightLine: 1 })], 'left');
    expect(wrapper.find('.pr-src-diff-pane__tint').exists()).toBe(false);
    expect(wrapper.find('[data-row-tint]').exists()).toBe(false);
    expect(sudu.views.at(-1)!.setModel).toHaveBeenCalledWith(sudu.diffModel);
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

  it('PR-DIFF-103: aligned rows drive the metrics table while SideDiff owns gutter numbers', async () => {
    const rows = [
      row({ kind: 'same', leftLine: 1, rightLine: 1, leftText: 'a', rightText: 'a' }),
      row({ kind: 'changed', leftLine: 7, rightLine: null, leftText: 'b', rightText: '' }),
    ];
    const wrapper = await mountPane(rows, 'left');
    expect(wrapper.get('tr[data-line="1"] [data-col="cycles"]').text()).toBe('10');
    expect(wrapper.get('tr[data-line="2"] [data-col="cycles"]').text()).toBe('70');
    expect(sudu.sides.at(-1)).toBe(true);
    expect(sudu.views.at(-1)!.setModel).toHaveBeenCalledWith(sudu.diffModel);
    wrapper.unmount();

    const rightWrapper = await mountPane(rows, 'right');
    expect(rightWrapper.get('tr[data-line="2"]').classes()).toContain('pr-src-metrics__row--blank');
    rightWrapper.unmount();
  });

  it('PR-DIFF-111: removed code rows use theme index 15, added 17, edited 23', async () => {
    const file: SourceFileModel = {
      ...metrics,
      lines: [1, 2, 3, 5].map((line) => ({ line, values: { cycles: line * 10 } })),
    };
    const rows = [
      row({ kind: 'same', leftLine: 1, rightLine: 1 }),
      row({ kind: 'changed', leftLine: 2, rightLine: 2, leftText: 'a', rightText: 'b' }),
      row({ kind: 'onlyLeft', leftLine: 3, rightLine: null, leftText: 'x' }),
      row({ kind: 'onlyRight', leftLine: null, rightLine: 5, rightText: 'y' }),
    ];

    const right = await mountPane(rows, 'right', file);
    const theme = (sudu.args.at(-1) as { theme: Record<number, unknown> }).theme;
    expect(theme[15]).toBe('#432224');
    // Index 17 is the added tone: both one-sided kinds paint the design brown.
    expect(theme[17]).toBe('#432224');
    // Index 23 is the edited band for a changed row both files have.
    expect(theme[23]).toBe('#463520');
    expect(right.get('tr[data-line="2"]').classes()).toContain('pr-src-metrics__row--modified');
    expect(right.get('tr[data-line="4"]').classes()).toContain('pr-src-metrics__row--removed');
    // onlyLeft is a spacer on this side, so its metrics row stays untinted.
    expect(right.get('tr[data-line="3"]').classes()).not.toContain('pr-src-metrics__row--removed');
    right.unmount();

    const left = await mountPane(rows, 'left', file);
    expect(left.get('tr[data-line="2"]').classes()).toContain('pr-src-metrics__row--modified');
    expect(left.get('tr[data-line="3"]').classes()).toContain('pr-src-metrics__row--removed');
    expect(left.get('tr[data-line="4"]').classes()).not.toContain('pr-src-metrics__row--removed');
    left.unmount();
  });

  it('PR-DIFF-111: plane divider and inset row separators match the design CSS', () => {
    // Removed band shifted to the measured design brown; the modified band matches theme 23.
    expect(tableSrc).toContain('background: #472628;');
    expect(tableSrc).toContain('background: #4a3924;');
    // Inset line keeps the 18px row height and skips tinted and blank spacer rows.
    expect(tableSrc).toContain('box-shadow: inset 0 -1px 0 #2a2a2a;');
    expect(tableSrc).toContain(':not(.pr-src-metrics__row--blank) td {');
    // 1px divider on the metrics side of the boundary, both panes share this rule.
    expect(paneSrc).toContain('border-left: 1px solid #2a2a2a;');
    // Metrics/header plane bottom edge is lighter than the #2a2a2a head.
    expect(paneSrc).toContain('border-bottom: 1px solid #353535;');
    expect(paneSrc).toContain('deviceFont / (dpr || 1)');
  });

  it('PR-DIFF-110: browser zoom re-measures geometry and keeps the visible source row', async () => {
    const rows = [row({ kind: 'same', leftLine: 1, rightLine: 1, leftText: 'a', rightText: 'a' })];
    const wrapper = await mountPane(rows, 'left');
    const view = sudu.views.at(-1)!;
    const scroll = wrapper.get('[data-testid="source-metrics-scroll"]').element as HTMLElement;
    const rowEl = wrapper.get('tr[data-line="1"]').element as HTMLElement;
    const rowHeight = () => parseFloat(rowEl.style.height);
    expect(rowHeight()).toBe(18);
    scroll.scrollTop = 600;
    scroll.dispatchEvent(new Event('scroll'));
    expect(view.setVScrollPos).toHaveBeenLastCalledWith(600);
    const topRow = Math.floor(600 / rowHeight());
    expect(topRow).toBeGreaterThan(0);

    // Browser zoom: device ratio doubles, so one CSS px is two device px.
    sudu.dpr = 2;
    Object.defineProperty(window, 'devicePixelRatio', { value: 2, configurable: true });
    window.dispatchEvent(new Event('resize'));
    await nextTick();

    // The row height halves, but the table still starts at the same source row.
    expect(rowHeight()).toBe(9);
    expect(scroll.scrollTop).toBe(topRow * rowHeight());
    expect(Math.floor(scroll.scrollTop / rowHeight())).toBe(topRow);
    expect(view.setVScrollPos).toHaveBeenLastCalledWith(topRow * rowHeight() * 2);

    // A second resize at the same ratio must not re-measure or re-scroll.
    const calls = view.setVScrollPos.mock.calls.length;
    window.dispatchEvent(new Event('resize'));
    await nextTick();
    expect(view.setVScrollPos).toHaveBeenCalledTimes(calls);

    wrapper.unmount();
    sudu.dpr = 1;
    Object.defineProperty(window, 'devicePixelRatio', { value: 1, configurable: true });
  });

  it('PR-DIFF-103: view rows past source lineCount still render', async () => {
    const rows = [
      row({ kind: 'same', leftLine: 1, rightLine: 1, leftText: 'a', rightText: 'a' }),
      row({ kind: 'onlyLeft', leftLine: 2, rightLine: null, leftText: 'b' }),
      row({ kind: 'onlyRight', leftLine: null, rightLine: 3, rightText: 'c' }),
    ];
    const wrapper = await mountPane(rows, 'left', { ...metrics, lineCount: 1 });
    expect(wrapper.findAll('tr[data-line]')).toHaveLength(3);
    wrapper.unmount();
  });

  it('a programmatic scroll does not bounce back into the editor', async () => {
    const rows = [row({ kind: 'same', leftLine: 1, rightLine: 1, leftText: 'a', rightText: 'a' })];
    const wrapper = await mountPane(rows, 'left');
    const view = sudu.views.at(-1)!;
    (wrapper.vm as unknown as { setScrollCss: (css: number) => void }).setScrollCss(40);
    view.setVScrollPos.mockClear();
    wrapper.get('[data-testid="source-metrics-scroll"]').element.dispatchEvent(new Event('scroll'));
    expect(view.setVScrollPos).not.toHaveBeenCalled();
    wrapper.unmount();
  });

  it('labels each file with its path', async () => {
    const rows = [row({ kind: 'same', leftLine: 1, rightLine: 1 })];
    const wrapper = await mountPane(rows, 'left', {
      ...metrics,
      path: 'src/kernel.asc',
      id: 'src/kernel.asc',
    });
    expect(wrapper.get('[data-testid="source-diff-file-left-label"]').text()).toBe('src/kernel.asc');
    wrapper.unmount();
  });

  it('PR-DIFF-112: workspace pick button follows availability and emits', async () => {
    const rows = [row({ kind: 'same', leftLine: 1, rightLine: 1 })];
    const bare = await mountPane(rows, 'left');
    expect(bare.find('[data-testid="source-diff-workspace-left"]').exists()).toBe(false);
    bare.unmount();

    const wrapper = mount(SourceDiffPane, {
      props: {
        rows,
        side: 'right',
        metrics,
        locale: 'en-US',
        diffModel: sudu.diffModel,
        workers: sudu.pool,
        workspaceAvailable: true,
        workspaceTitle: 'Pick baseline source workspace',
      },
      attachTo: document.body,
    });
    await flushPromises();
    const button = wrapper.find('[data-testid="source-diff-workspace-right"]');
    expect(button.exists()).toBe(true);
    expect(button.attributes('aria-label')).toBe('Pick baseline source workspace');
    expect(button.classes()).toContain('pr-src-diff-pane__icon-btn');
    await button.trigger('click');
    expect(wrapper.emitted('pick-workspace')).toHaveLength(1);
    wrapper.unmount();
  });
});
