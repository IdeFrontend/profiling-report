import { describe, expect, it } from 'vitest';
import { mount } from '@vue/test-utils';
import MemoryHeatmapPanel from './MemoryHeatmapPanel.vue';
import type { MemoryHeatmapModel, MemoryHeatmapView } from '../../../domain/types';

function blocks(count: number, withData: number) {
  return Array.from({ length: count }, (_, index) => {
    const hot = index < withData;
    // Spread intensities across hot cells so the gradient path is covered (#200).
    const intensity = hot ? (withData <= 1 ? 1 : (index + 1) / withData) : 0;
    // BiProf tip value — hot cells use a comma-worthy count so PR-HEAT-013 can lock grouping.
    const accessCount = hot ? (index === 0 ? 300_090 : (index + 1) * 16) : 0;
    return {
      index,
      state: hot ? ('withData' as const) : ('withoutData' as const),
      intensity,
      accessCount,
    };
  });
}

function view(partial: Partial<MemoryHeatmapView> & Pick<MemoryHeatmapView, 'blocks'>): MemoryHeatmapView {
  return {
    coreId: 0,
    coreTypeId: 1,
    memoryName: 'UB',
    columns: 16,
    rows: 26,
    cellSize: 128,
    baseAddress: 0,
    ...partial,
  };
}

const model: MemoryHeatmapModel = {
  units: [
    {
      id: 'ub',
      views: [
        view({
          coreId: 0,
          coreTypeId: 2,
          ownerName: 'AIV0',
          memoryName: 'UB',
          blocks: blocks(416, 20),
          totalBytes: 262144,
          usedBytes: 2560,
          freeBytes: 259584,
        }),
        view({
          coreId: 1,
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

function mountPanel(
  overrides: Partial<InstanceType<typeof MemoryHeatmapPanel>['$props']> = {},
  mountOpts: { attachTo?: HTMLElement } = {},
) {
  return mount(MemoryHeatmapPanel, {
    props: { model, selectedUnit: 'ub', locale: 'zh-CN', ...overrides },
    ...mountOpts,
  });
}

describe('MemoryHeatmapPanel', () => {
  it('PR-HEAT-001: keeps the five heat tabs, even for units the model has no source for', () => {
    const wrapper = mountPanel();
    const tabs = wrapper.findAll('[role="tab"]');
    expect(tabs.map((t) => t.text())).toEqual(['L1', 'UB', 'L0A', 'L0B', 'L0C']);
    expect(tabs).toHaveLength(5);
  });

  it('PR-HEAT-002: legend is a single % tick HSL gradient strip (#200)', () => {
    const wrapper = mountPanel({ locale: 'en' });
    const legend = wrapper.get('[data-testid="heat-legend"]');
    expect(legend.get('[data-testid="heat-legend-gradient"]').exists()).toBe(true);
    const ticks = legend.findAll('[data-testid="heat-legend-ticks"] .pr-heat__legend-tick');
    expect(ticks.map((n) => n.text())).toEqual([
      '0%',
      '10%',
      '20%',
      '30%',
      '40%',
      '50%',
      '60%',
      '70%',
      '80%',
      '90%',
      '100%',
    ]);
    expect(legend.text()).not.toContain('Low');
    expect(legend.text()).not.toContain('High');
  });

  it('PR-HEAT-003: paints one cell per block with continuous HSL intensity (#200)', () => {
    const wrapper = mountPanel();
    const cells = wrapper.findAll('.pr-heat__cell');
    expect(cells).toHaveLength(416);
    expect(cells[0].attributes('data-state')).toBe('withData');
    expect(Number(cells[0].attributes('data-intensity'))).toBeGreaterThan(0);
    expect(cells[0].attributes('style')).toMatch(/background:\s*hsl\(/);
    expect(cells[20].attributes('data-state')).toBe('withoutData');
    expect(cells[20].attributes('data-intensity')).toBe('0');
    expect(cells[20].attributes('style')).toMatch(/hsl\(100/);
  });

  it('PR-HEAT-004: shows Total/Used/Free with spaced shared units (#201); omits when Total is unknown', () => {
    expect(mountPanel().find('[data-testid="heat-metric"]').text()).toBe(
      'Total: 256 KB / Used: 2.5 KB / Free: 253.5 KB',
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
    // Sibling of the body — not a child — so it cannot clip the lattice (PR-HEAT-011).
    expect(body.contains(badge.element)).toBe(false);
  });

  it('PR-HEAT-008: exposes the grid as one image, not per-cell roles', () => {
    const grid = mountPanel().find('[data-testid="heat-grid"]');
    expect(grid.attributes('role')).toBe('img');
    expect(grid.attributes('aria-label')).toBe('20 / 416 个块已用');
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
    expect(wrapper.get('[data-testid="heat-unit-name"]').text()).toBe('Core 0 · AIV0 UB');
    await trigger.trigger('click');
    const item = document.querySelector(
      '[data-testid="heat-view-select-menu"] [data-value="1"]',
    ) as HTMLElement | null;
    expect(item).not.toBeNull();
    expect(item!.textContent).toContain('Core 1 · AIV1 UB');
    item!.click();
    await wrapper.vm.$nextTick();
    expect(wrapper.get('[data-testid="heat-unit-name"]').text()).toBe('Core 1 · AIV1 UB');
    expect(wrapper.findAll('.pr-heat__cell--with')).toHaveLength(10);
  });

  it('PR-HEAT-012: single-view tabs keep the reserved view-bar band (same lattice height)', () => {
    const wrapper = mountPanel({ selectedUnit: 'l1' });
    expect(wrapper.get('[data-testid="heat-view-bar"]').attributes('data-empty')).toBe('true');
    expect(wrapper.find('[data-testid="heat-view-select"]').exists()).toBe(false);
    // Pack still has core 0 and core 1 — L1 title keeps the Core prefix (#198 / R2).
    expect(wrapper.get('[data-testid="heat-unit-name"]').text()).toBe('Core 0 · AIC L1');
  });

  it('PR-HEAT-010: repeats the selected view name under the grid', () => {
    const wrapper = mountPanel({ selectedUnit: 'ub' });
    expect(wrapper.get('[data-testid="heat-unit-name"]').text()).toBe('Core 0 · AIV0 UB');
  });

  it('PR-HEAT-010b: single-core packs omit the Core id prefix', async () => {
    const single: MemoryHeatmapModel = {
      units: [
        {
          id: 'ub',
          views: [
            view({
              coreId: 0,
              ownerName: 'AIV0',
              memoryName: 'UB',
              blocks: blocks(8, 1),
              totalBytes: 256,
              usedBytes: 32,
              freeBytes: 224,
            }),
            // Same coreId, two owners — selector required, Core prefix forbidden (#198 / R2).
            view({
              coreId: 0,
              ownerName: 'AIV1',
              memoryName: 'UB',
              blocks: blocks(8, 2),
              totalBytes: 256,
              usedBytes: 64,
              freeBytes: 192,
            }),
          ],
        },
        {
          id: 'l1',
          views: [
            view({
              coreId: 0,
              ownerName: 'AIC',
              memoryName: 'L1',
              blocks: blocks(8, 0),
              totalBytes: 512,
              usedBytes: 0,
              freeBytes: 512,
            }),
          ],
        },
      ],
    };
    const ub = mountPanel({ model: single, selectedUnit: 'ub' });
    expect(ub.get('[data-testid="heat-unit-name"]').text()).toBe('AIV0 UB');
    expect(ub.get('[data-testid="heat-unit-name"]').text()).not.toContain('Core');
    expect(ub.get('[data-testid="heat-view-bar"]').attributes('data-empty')).toBeUndefined();
    await ub.get('[data-testid="heat-view-select"]').trigger('click');
    const items = [
      ...document.querySelectorAll('[data-testid="heat-view-select-menu"] [role="option"]'),
    ].map((el) => el.textContent?.trim());
    expect(items).toEqual(['AIV0 UB', 'AIV1 UB']);
    const l1 = mountPanel({ model: single, selectedUnit: 'l1' });
    expect(l1.get('[data-testid="heat-unit-name"]').text()).toBe('AIC L1');
  });

  it('PR-HEAT-010c: multi-core no-owner under-grid title matches viewOptionLabel', async () => {
    const noOwner: MemoryHeatmapModel = {
      units: [
        {
          id: 'ub',
          views: [
            view({
              coreId: 0,
              memoryName: 'UB',
              blocks: blocks(8, 1),
              totalBytes: 256,
              usedBytes: 32,
              freeBytes: 224,
            }),
            view({
              coreId: 1,
              memoryName: 'UB',
              blocks: blocks(8, 2),
              totalBytes: 256,
              usedBytes: 64,
              freeBytes: 192,
            }),
          ],
        },
      ],
    };
    const wrapper = mountPanel({ model: noOwner, selectedUnit: 'ub' });
    expect(wrapper.get('[data-testid="heat-unit-name"]').text()).toBe('Core 0 · UB');
    await wrapper.get('[data-testid="heat-view-select"]').trigger('click');
    const menus = document.querySelectorAll('[data-testid="heat-view-select-menu"]');
    const second = menus[menus.length - 1]?.querySelector('[data-value="1"]') as HTMLElement | null;
    expect(second?.textContent?.trim()).toBe('Core 1 · UB');
    second?.click();
    await wrapper.vm.$nextTick();
    expect(wrapper.get('[data-testid="heat-unit-name"]').text()).toBe('Core 1 · UB');
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

  it('PR-HEAT-013: SA cell tip shows Start Address, Cell Size, Accesses Count + hover ring', async () => {
    const wrapper = mountPanel(
      {
        selectedUnit: 'ub',
        locale: 'zh-CN',
        model: {
          units: [
            {
              id: 'ub',
              views: [
                view({
                  memoryName: 'UB',
                  cellSize: 128,
                  baseAddress: 0x100,
                  blocks: blocks(8, 2),
                  totalBytes: 1024,
                  usedBytes: 256,
                  freeBytes: 768,
                }),
              ],
            },
          ],
        },
      },
      { attachTo: document.body },
    );
    const cell = wrapper.findAll('.pr-heat__cell')[0]!;
    expect(cell.attributes('data-access-count')).toBe('300090');
    await cell.trigger('pointerenter', { clientX: 40, clientY: 60 });
    expect(cell.classes()).toContain('pr-heat__cell--hover');
    const tip = document.querySelector('[data-testid="heat-cell-tooltip"]');
    expect(tip).not.toBeNull();
    // BaseAddress 0x100 + index 0 * 128 = 0x100
    expect(tip!.querySelector('[data-testid="heat-cell-tip-address"]')!.textContent).toContain('起始地址');
    expect(tip!.querySelector('[data-testid="heat-cell-tip-address-value"]')!.textContent).toBe('0x100');
    expect(tip!.querySelector('[data-testid="heat-cell-tip-cell-size"]')!.textContent).toContain('单元大小');
    expect(tip!.querySelector('[data-testid="heat-cell-tip-cell-size-value"]')!.textContent).toBe(
      '128 Bytes',
    );
    expect(tip!.querySelector('[data-testid="heat-cell-tip-accesses"]')!.textContent).toContain('访问次数');
    expect(tip!.querySelector('[data-testid="heat-cell-tip-accesses-value"]')!.textContent).toBe(
      '300,090',
    );
    // EventTooltip chrome on the teleported tip.
    expect((tip as HTMLElement).classList.contains('pr-tooltip')).toBe(true);
    // Leaving a cell into the seam must not thrash — sticky until grid leave / other cell.
    await cell.trigger('pointerleave');
    expect(cell.classes()).toContain('pr-heat__cell--hover');
    expect(document.querySelector('[data-testid="heat-cell-tooltip"]')).not.toBeNull();
    await wrapper.get('[data-testid="heat-grid"]').trigger('pointerleave');
    expect(cell.classes()).not.toContain('pr-heat__cell--hover');
    expect(document.querySelector('[data-testid="heat-cell-tooltip"]')).toBeNull();
    wrapper.unmount();
  });

  it('PR-HEAT-013: tip sticks across cell seams; switches only on another cell', async () => {
    const wrapper = mountPanel({ selectedUnit: 'ub', locale: 'en' }, { attachTo: document.body });
    const cells = wrapper.findAll('.pr-heat__cell');
    await cells[0]!.trigger('pointerenter', { clientX: 10, clientY: 10 });
    expect(cells[0]!.classes()).toContain('pr-heat__cell--hover');
    expect(
      document.querySelector('[data-testid="heat-cell-tip-accesses-value"]')!.textContent,
    ).toBe('300,090');
    await cells[0]!.trigger('pointerleave');
    expect(cells[0]!.classes()).toContain('pr-heat__cell--hover');
    await cells[1]!.trigger('pointerenter', { clientX: 20, clientY: 10 });
    expect(cells[0]!.classes()).not.toContain('pr-heat__cell--hover');
    expect(cells[1]!.classes()).toContain('pr-heat__cell--hover');
    expect(
      document.querySelector('[data-testid="heat-cell-tip-accesses-value"]')!.textContent,
    ).toBe('32');
    wrapper.unmount();
  });

  it('PR-HEAT-013: EN tip labels match SA Accesses Count', async () => {
    const wrapper = mountPanel({ selectedUnit: 'ub', locale: 'en' }, { attachTo: document.body });
    await wrapper.findAll('.pr-heat__cell')[0]!.trigger('pointerenter', { clientX: 10, clientY: 10 });
    const tip = document.querySelector('[data-testid="heat-cell-tooltip"]');
    expect(tip!.textContent).toContain('Start Address');
    expect(tip!.textContent).toContain('Cell Size');
    expect(tip!.textContent).toContain('Accesses Count');
    expect(tip!.querySelector('[data-testid="heat-cell-tip-address-value"]')!.textContent).toBe('0x0');
    wrapper.unmount();
  });
});
