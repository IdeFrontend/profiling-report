import { describe, expect, it } from 'vitest';
import { mount } from '@vue/test-utils';
import MemoryHeatmapPanel from './MemoryHeatmapPanel.vue';
import type { MemoryHeatmapModel, MemoryHeatmapView } from '../../../domain/types';

function blocks(count: number, withData: number) {
  return Array.from({ length: count }, (_, index) => ({
    index,
    state: index < withData ? ('withData' as const) : ('withoutData' as const),
  }));
}

function view(partial: Partial<MemoryHeatmapView> & Pick<MemoryHeatmapView, 'blocks'>): MemoryHeatmapView {
  return {
    coreId: 0,
    coreTypeId: 1,
    memoryName: 'UB',
    columns: 16,
    rows: 26,
    ...partial,
  };
}

const model: MemoryHeatmapModel = {
  units: [
    {
      id: 'ub',
      views: [
        view({
          coreTypeId: 2,
          ownerName: 'AIV0',
          memoryName: 'UB',
          blocks: blocks(416, 20),
          totalBytes: 262144,
          usedBytes: 2560,
          freeBytes: 259584,
        }),
        view({
          coreTypeId: 3,
          ownerName: 'AIV1',
          memoryName: 'UB',
          blocks: blocks(416, 10),
          totalBytes: 262144,
          usedBytes: 1280,
          freeBytes: 260864,
        }),
      ],
    },
    {
      id: 'l1',
      views: [
        view({
          memoryName: 'L1',
          ownerName: 'AIC',
          blocks: blocks(416, 0),
          totalBytes: 524288,
          usedBytes: 0,
          freeBytes: 524288,
        }),
      ],
    },
  ],
};

function mountPanel(overrides: Partial<InstanceType<typeof MemoryHeatmapPanel>['$props']> = {}) {
  return mount(MemoryHeatmapPanel, {
    props: { model, selectedUnit: 'ub', locale: 'zh-CN', ...overrides },
  });
}

describe('MemoryHeatmapPanel', () => {
  it('PR-HEAT-001: keeps the five heat tabs, even for units the model has no source for', () => {
    const wrapper = mountPanel();
    const tabs = wrapper.findAll('[role="tab"]');
    expect(tabs.map((t) => t.text())).toEqual(['L1', 'UB', 'L0A', 'L0B', 'L0C']);
    expect(tabs).toHaveLength(5);
  });

  it('PR-HEAT-002: names both allocation states beside their swatches', () => {
    const wrapper = mountPanel();
    expect(wrapper.text()).toContain('已分配有数据');
    expect(wrapper.text()).toContain('已分配无数据');
  });

  it('PR-HEAT-003: paints one cell per block from the active view', () => {
    const wrapper = mountPanel();
    const cells = wrapper.findAll('.pr-heat__cell');
    expect(cells).toHaveLength(416);
    expect(cells[0].attributes('data-state')).toBe('withData');
    expect(cells[20].attributes('data-state')).toBe('withoutData');
  });

  it('PR-HEAT-004: shows Total/Used/Free; omits when Total is unknown', () => {
    expect(mountPanel().find('[data-testid="heat-metric"]').text()).toBe(
      'Total: 256KB / Used: 2560B / Free: 259584B',
    );
    const noCap: MemoryHeatmapModel = {
      units: [{ id: 'l1', views: [view({ memoryName: 'L1', blocks: blocks(8, 1), usedBytes: 32 })] }],
    };
    expect(
      mountPanel({ model: noCap, selectedUnit: 'l1' }).find('[data-testid="heat-metric"]').exists(),
    ).toBe(false);
  });

  it('PR-HEAT-004b: OutsideDeclared badges the view outside the body size box', () => {
    const outside: MemoryHeatmapModel = {
      units: [
        {
          id: 'l0a',
          views: [
            view({
              memoryName: 'L0A',
              columns: 4,
              rows: 2,
              blocks: blocks(8, 2),
              totalBytes: 256,
              usedBytes: 64,
              freeBytes: 192,
              outsideDeclared: true,
            }),
          ],
        },
      ],
    };
    const wrapper = mountPanel({ model: outside, selectedUnit: 'l0a' });
    const badge = wrapper.get('[data-testid="heat-outside"]');
    const body = wrapper.get('[data-testid="heat-body"]').element;
    expect(badge.exists()).toBe(true);
    // Sibling of the body — not a child — so it cannot clip the lattice (PR-HEAT-011).
    expect(body.contains(badge.element)).toBe(false);
  });

  it('PR-HEAT-008: exposes the grid as one image, not per-cell roles', () => {
    const grid = mountPanel().find('[data-testid="heat-grid"]');
    expect(grid.attributes('role')).toBe('img');
    expect(grid.attributes('aria-label')).toBe('20 / 416 个块已分配有数据');
    expect(grid.findAll('[role="img"]')).toHaveLength(0);
  });

  it('PR-HEAT-009: is a real tablist — one tab stop, and Arrow / Home / End move it', async () => {
    const wrapper = mountPanel({ selectedUnit: 'ub' });
    const tab = (id: string) => wrapper.get(`[data-testid="heat-tab-${id}"]`);
    expect(wrapper.findAll('[role="tab"][tabindex="0"]')).toHaveLength(1);
    expect(tab('ub').attributes('tabindex')).toBe('0');
    expect(tab('l1').attributes('tabindex')).toBe('-1');
    const panel = wrapper.get('[data-testid="heat-body"]');
    expect(panel.attributes('role')).toBe('tabpanel');
    expect(panel.attributes('aria-labelledby')).toBe('heat-tab-ub');

    await wrapper.get('[data-testid="heat-tabs"]').trigger('keydown', { key: 'ArrowRight' });
    expect(wrapper.emitted('select-unit')).toEqual([['l0a']]);
    await wrapper.get('[data-testid="heat-tabs"]').trigger('keydown', { key: 'ArrowLeft' });
    expect(wrapper.emitted('select-unit')![1]).toEqual(['l1']);
    await wrapper.get('[data-testid="heat-tabs"]').trigger('keydown', { key: 'Home' });
    expect(wrapper.emitted('select-unit')![2]).toEqual(['l1']);
    await wrapper.get('[data-testid="heat-tabs"]').trigger('keydown', { key: 'End' });
    expect(wrapper.emitted('select-unit')![3]).toEqual(['l0c']);
    await wrapper.get('[data-testid="heat-tabs"]').trigger('keydown', { key: 'Tab' });
    expect(wrapper.emitted('select-unit')).toHaveLength(4);
    expect(tab('ub').attributes('aria-selected')).toBe('true');

    const unselected = mountPanel({ selectedUnit: null });
    const stops = unselected.findAll('[role="tab"][tabindex="0"]');
    expect(stops).toHaveLength(1);
    expect(stops[0].attributes('data-testid')).toBe('heat-tab-l1');
    expect(unselected.findAll('[role="tab"][aria-selected="true"]')).toHaveLength(0);
  });

  it('PR-HEAT-012: multi-view UB exposes a selector and switches the lattice', async () => {
    const wrapper = mountPanel();
    expect(wrapper.get('[data-testid="heat-view-bar"]').attributes('data-empty')).toBeUndefined();
    const trigger = wrapper.get('[data-testid="heat-view-select"]');
    expect(trigger.classes()).toContain('pr-block-pill');
    expect(wrapper.get('[data-testid="heat-unit-name"]').text()).toBe('AIV0 UB');
    await trigger.trigger('click');
    const item = document.querySelector(
      '[data-testid="heat-view-select-menu"] [data-value="1"]',
    ) as HTMLElement | null;
    expect(item).not.toBeNull();
    item!.click();
    await wrapper.vm.$nextTick();
    expect(wrapper.get('[data-testid="heat-unit-name"]').text()).toBe('AIV1 UB');
    expect(wrapper.findAll('.pr-heat__cell--with')).toHaveLength(10);
  });

  it('PR-HEAT-012: single-view tabs keep the reserved view-bar band (same lattice height)', () => {
    const wrapper = mountPanel({ selectedUnit: 'l1' });
    expect(wrapper.get('[data-testid="heat-view-bar"]').attributes('data-empty')).toBe('true');
    expect(wrapper.find('[data-testid="heat-view-select"]').exists()).toBe(false);
  });

  it('PR-HEAT-010: repeats the selected view name under the grid', () => {
    const wrapper = mountPanel({ selectedUnit: 'ub' });
    expect(wrapper.get('[data-testid="heat-unit-name"]').text()).toBe('AIV0 UB');
  });

  it('PR-HEAT-005: blanks a selected unit the model has no source for', () => {
    const wrapper = mountPanel({ selectedUnit: 'l0c' });
    expect(wrapper.find('[data-testid="heat-empty"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="heat-grid"]').exists()).toBe(false);
  });

  it('PR-HEAT-006: emits select-unit without mutating selection itself', async () => {
    const wrapper = mountPanel();
    await wrapper.get('[data-testid="heat-tab-l1"]').trigger('click');
    expect(wrapper.emitted('select-unit')?.at(-1)).toEqual(['l1']);
    expect(wrapper.find('[data-testid="heat-tab-ub"]').attributes('aria-selected')).toBe('true');
  });

  it('PR-HEAT-007: renders nothing without units', () => {
    expect(mountPanel({ model: { units: [] } }).find('[data-testid="memory-heatmap-panel"]').exists()).toBe(
      false,
    );
  });
});
