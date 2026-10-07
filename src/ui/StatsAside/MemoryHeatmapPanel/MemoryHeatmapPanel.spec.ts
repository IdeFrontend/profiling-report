import { describe, expect, it } from 'vitest';
import { mount } from '@vue/test-utils';
import MemoryHeatmapPanel from './MemoryHeatmapPanel.vue';
import { HEATMAP_BLOCK_COUNT, HEATMAP_COLUMNS } from '../../../adapters/emulateMemoryHeatmap';
import type { MemoryHeatmapModel } from '../../../domain/types';

/** 416 blocks, the low half allocated — the shape the carrier ships for `UbRwAccesses`. */
function blocks(withData: number) {
  return Array.from({ length: HEATMAP_BLOCK_COUNT }, (_, index) => ({
    index,
    state: index < withData ? ('withData' as const) : ('withoutData' as const),
  }));
}

const model: MemoryHeatmapModel = {
  units: [
    { id: 'ub', blocks: blocks(20), usedInstructionCount: 300090 },
    { id: 'l1', blocks: blocks(0) },
  ],
};

function mountPanel(overrides: Partial<InstanceType<typeof MemoryHeatmapPanel>['$props']> = {}) {
  return mount(MemoryHeatmapPanel, {
    props: { model, selectedUnit: 'ub', locale: 'zh-CN', ...overrides },
  });
}

describe('MemoryHeatmapPanel', () => {
  it('PR-HEAT-001: keeps the frame’s six tabs, even for units the model has no source for', () => {
    const wrapper = mountPanel();
    const tabs = wrapper.findAll('[role="tab"]');
    expect(tabs.map((t) => t.text())).toEqual(['L2Cache', 'L1', 'UB', 'L0A', 'L0B', 'L0C']);
    expect(wrapper.find('[role="tablist"]').exists()).toBe(true);
    // The model carries two units; the strip is still six (L2/L0A/L0B/L0C have no source yet).
    expect(tabs).toHaveLength(6);
  });

  it('PR-HEAT-002: names both allocation states beside their swatches', () => {
    const wrapper = mountPanel();
    expect(wrapper.find('.pr-heat__swatch--with').exists()).toBe(true);
    expect(wrapper.find('.pr-heat__swatch--without').exists()).toBe(true);
    expect(wrapper.text()).toContain('已分配有数据');
    expect(wrapper.text()).toContain('已分配无数据');
  });

  it('PR-HEAT-003: paints one cell per block, in carrier order, in the two legend states', () => {
    const wrapper = mountPanel();
    const cells = wrapper.findAll('.pr-heat__cell');
    expect(cells).toHaveLength(HEATMAP_BLOCK_COUNT);
    expect(HEATMAP_COLUMNS).toBe(16);
    expect(cells[0].attributes('data-state')).toBe('withData');
    expect(cells[0].classes()).toContain('pr-heat__cell--with');
    expect(cells[19].attributes('data-state')).toBe('withData');
    expect(cells[20].attributes('data-state')).toBe('withoutData');
    expect(cells[20].classes()).not.toContain('pr-heat__cell--with');
    // The grid is one lattice — no per-cell divider band, and the column count is bound from the
    // constant rather than restated in the CSS (PR-HEAT-003).
    expect(cells.some((c) => c.classes().includes('pr-heat__cell--band'))).toBe(false);
    expect(wrapper.get('[data-testid="heat-grid"]').attributes('style')).toContain('--pr-heat-cols');
  });

  it('PR-HEAT-004: groups the instruction count, and omits the line when there is none', () => {
    expect(mountPanel().find('[data-testid="heat-metric"]').text()).toBe('已用指令条数 300,090');
    const noCount = mountPanel({ selectedUnit: 'l1' });
    expect(noCount.find('[data-testid="heat-metric"]').exists()).toBe(false);
    expect(noCount.find('[data-testid="heat-grid"]').exists()).toBe(true);
  });

  it('PR-HEAT-010: repeats the selected unit in the diagram’s words under the grid', () => {
    const wrapper = mountPanel({ selectedUnit: 'ub' });
    const name = wrapper.get('[data-testid="heat-unit-name"]');
    expect(name.text()).toBe('AIV × 2 UB');
    // Under the grid, above the caption — the strip's own tab keeps the short label.
    const body = wrapper.get('[data-testid="heat-body"]');
    expect(body.element.children[0].getAttribute('data-testid')).toBe('heat-grid');
    expect(body.element.children[1].getAttribute('data-testid')).toBe('heat-unit-name');
    expect(body.element.children[2].getAttribute('data-testid')).toBe('heat-metric');
    // A unit with no source blanks its whole body, name included.
    expect(
      mountPanel({ selectedUnit: 'l2' }).find('[data-testid="heat-unit-name"]').exists(),
    ).toBe(false);
  });

  it('PR-HEAT-005: blanks a selected unit the model has no source for', () => {
    const wrapper = mountPanel({ selectedUnit: 'l2' });
    expect(wrapper.find('[data-testid="heat-empty"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="heat-empty"]').text()).toBe('该 Memory 暂无访问数据');
    expect(wrapper.find('[data-testid="heat-grid"]').exists()).toBe(false);
    // One tabpanel for the whole strip: a blanked unit keeps the body (named by its own tab) and
    // only the grid goes away.
    expect(wrapper.get('[data-testid="heat-body"]').attributes('aria-labelledby')).toBe(
      'heat-tab-l2',
    );
    // The tab is still there and still selected — the strip does not move under the pointer.
    expect(wrapper.find('[data-testid="heat-tab-l2"]').attributes('aria-selected')).toBe('true');
  });

  it('PR-HEAT-006: renders the host’s selection and emits the clicked unit', async () => {
    const wrapper = mountPanel();
    const selected = wrapper.findAll('[role="tab"][aria-selected="true"]');
    expect(selected).toHaveLength(1);
    expect(selected[0].text()).toBe('UB');
    await wrapper.find('[data-testid="heat-tab-l0a"]').trigger('click');
    expect(wrapper.emitted('select-unit')).toEqual([['l0a']]);
    // Presentational: the click alone does not move the selection.
    expect(wrapper.find('[data-testid="heat-tab-ub"]').attributes('aria-selected')).toBe('true');
  });

  it('PR-HEAT-007: renders nothing without a model, or with an empty one', () => {
    expect(mountPanel({ model: null }).find('[data-testid="memory-heatmap-panel"]').exists()).toBe(
      false,
    );
    expect(mountPanel({ model: { units: [] } }).text()).toBe('');
  });

  it('PR-HEAT-008: exposes the grid as one image, not 416 cells', () => {
    const grid = mountPanel().find('[data-testid="heat-grid"]');
    expect(grid.attributes('role')).toBe('img');
    expect(grid.attributes('aria-label')).toBe('20 / 416 个块已分配有数据');
    expect(grid.findAll('[role="img"]')).toHaveLength(0);
  });

  it('PR-HEAT-009: is a real tablist — one tab stop, and Arrow / Home / End move it', async () => {
    const wrapper = mountPanel({ selectedUnit: 'ub' });
    const tab = (id: string) => wrapper.get(`[data-testid="heat-tab-${id}"]`);
    // Roving tabindex: only the selected tab is in the document's tab order.
    expect(wrapper.findAll('[role="tab"][tabindex="0"]')).toHaveLength(1);
    expect(tab('ub').attributes('tabindex')).toBe('0');
    expect(tab('l1').attributes('tabindex')).toBe('-1');
    // The six share one body, so it is named by whichever tab is active.
    const panel = wrapper.get('[data-testid="heat-body"]');
    expect(panel.attributes('role')).toBe('tabpanel');
    expect(panel.attributes('aria-labelledby')).toBe('heat-tab-ub');

    await wrapper.get('[data-testid="heat-tabs"]').trigger('keydown', { key: 'ArrowRight' });
    expect(wrapper.emitted('select-unit')).toEqual([['l0a']]);
    await wrapper.get('[data-testid="heat-tabs"]').trigger('keydown', { key: 'ArrowLeft' });
    expect(wrapper.emitted('select-unit')![1]).toEqual(['l1']);
    // Wraps at both ends, the way a tablist does, and Home / End jump to the ends.
    await wrapper.get('[data-testid="heat-tabs"]').trigger('keydown', { key: 'Home' });
    expect(wrapper.emitted('select-unit')![2]).toEqual(['l2']);
    await wrapper.get('[data-testid="heat-tabs"]').trigger('keydown', { key: 'End' });
    expect(wrapper.emitted('select-unit')![3]).toEqual(['l0c']);
    // Any other key is left to the platform.
    await wrapper.get('[data-testid="heat-tabs"]').trigger('keydown', { key: 'Tab' });
    expect(wrapper.emitted('select-unit')).toHaveLength(4);

    // The selection is still the host's: nothing moved on its own.
    expect(tab('ub').attributes('aria-selected')).toBe('true');

    // With no host selection the strip must not fall out of the tab order: the first tab keeps the
    // single tab stop (the arrow handler already falls back to it), and nothing is marked selected.
    const unselected = mountPanel({ selectedUnit: null });
    const stops = unselected.findAll('[role="tab"][tabindex="0"]');
    expect(stops).toHaveLength(1);
    expect(stops[0].attributes('data-testid')).toBe('heat-tab-l2');
    expect(unselected.findAll('[role="tab"][aria-selected="true"]')).toHaveLength(0);
  });

  it('PR-HEAT-011: body scrolls vertically only (tabs and legend stay outside)', async () => {
    // Same source contract as PR-STATS-029 — happy-dom does not apply scoped CSS to
    // getComputedStyle, so the scrollport is locked in the stylesheet rather than measured.
    const src = (await import('./MemoryHeatmapPanel.vue?raw')).default as string;
    expect(src).toMatch(/\.pr-heat__body\s*\{[^}]*overflow-x:\s*hidden/s);
    expect(src).toMatch(/\.pr-heat__body\s*\{[^}]*overflow-y:\s*auto/s);
    expect(src).not.toMatch(/\.pr-heat__body\s*\{[^}]*overflow:\s*auto/s);
    // Root clips so the tab strip cannot scroll away with the body.
    expect(src).toMatch(/\.pr-heat\s*\{[^}]*overflow:\s*hidden/s);
    // Tabs and legend are siblings of the body, not inside it.
    const wrapper = mountPanel();
    const root = wrapper.get('[data-testid="memory-heatmap-panel"]').element;
    const body = wrapper.get('[data-testid="heat-body"]').element;
    expect(root.contains(wrapper.get('[data-testid="heat-tabs"]').element)).toBe(true);
    expect(body.contains(wrapper.get('[data-testid="heat-tabs"]').element)).toBe(false);
    expect(body.contains(wrapper.get('.pr-heat__legend').element)).toBe(false);
  });
});
