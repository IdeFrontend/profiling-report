import { describe, expect, it, vi } from 'vitest';
import { nextTick } from 'vue';
import { mount } from '@vue/test-utils';
import MemoryHeatmapPanel from './MemoryHeatmapPanel.vue';
import type { MemoryHeatmapModel, MemoryHeatmapView } from '../../../domain/types';

/** Legend slide updates coalesce to one rAF — flush before asserting mute/chrome. */
async function flushLegendBrushFrame() {
  await new Promise<void>((resolve) => {
    requestAnimationFrame(() => resolve());
  });
  await nextTick();
}

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

  it('PR-HEAT-002: legend is Access Count left of 150px Free→Used strip with 0 / max (#200)', () => {
    const wrapper = mountPanel({ locale: 'en' });
    const legend = wrapper.get('[data-testid="heat-legend"]');
    const title = legend.get('[data-testid="heat-legend-title"]');
    expect(title.text()).toBe('Access Count');
    expect(legend.find('[data-testid="heat-legend-gradient"]').exists()).toBe(true);
    expect(legend.get('.pr-heat__gradient').attributes('style')).toMatch(/#AFC6FE/i);
    expect(legend.get('.pr-heat__gradient').attributes('style')).toMatch(/#3D64AD/i);
    expect(legend.get('[data-testid="heat-legend-tick-min"]').text()).toBe('0');
    // Default fixture max accessCount is 300,090 on the first hot cell.
    expect(legend.get('[data-testid="heat-legend-tick-max"]').text()).toBe('300,090');
    // Title sits left of the strip column (DOM order); strip width is 150px.
    const strip = legend.get('[data-testid="heat-legend-strip"]');
    expect(title.element.compareDocumentPosition(strip.element) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(strip.attributes('style')).toMatch(/width:\s*150px/);
    expect(legend.text()).not.toContain('%');
    expect(legend.text()).not.toContain('Low');
    expect(legend.text()).not.toContain('High');
  });

  it('PR-HEAT-003: paints the lattice on base + bright canvases (no per-cell DOM)', async () => {
    const wrapper = mountPanel();
    await nextTick(); // canvas paint after mount
    const grid = wrapper.get('[data-testid="heat-grid"]');
    const board = grid.get('[data-testid="heat-board"]');
    expect(board.find('[data-testid="heat-canvas"]').exists()).toBe(true);
    expect(board.find('[data-testid="heat-mute-veil"]').exists()).toBe(true);
    expect(board.find('[data-testid="heat-canvas-bright"]').exists()).toBe(true);
    expect(grid.findAll('.pr-heat__cell')).toHaveLength(0);
    // a11y still reports used/total from the view (416 blocks, 20 with data).
    expect(grid.attributes('aria-label')).toBe('20 / 416 个块已用');
  });

  it('PR-HEAT-003: paints canvases from board/grid box (not --pr-heat-cell text)', async () => {
    // Regression: getPropertyValue('--pr-heat-cell') returns unresolved min(calc(cq*)),
    // so geom must come from the laid-out board/grid box or the lattice stays empty.
    const host = document.createElement('div');
    document.body.appendChild(host);
    const wrapper = mountPanel({}, { attachTo: host });
    const grid = wrapper.get('[data-testid="heat-grid"]').element as HTMLElement;
    const board = wrapper.get('[data-testid="heat-board"]').element as HTMLElement;
    grid.getBoundingClientRect = () =>
      ({
        x: 0,
        y: 0,
        left: 0,
        top: 0,
        right: 168,
        bottom: 268,
        width: 168,
        height: 268,
        toJSON() {
          return {};
        },
      }) as DOMRect;
    // Board uses CSS inset (no JS size); stub client box so paint has a positive area.
    Object.defineProperty(board, 'clientWidth', { configurable: true, get: () => 160 });
    Object.defineProperty(board, 'clientHeight', { configurable: true, get: () => 260 });
    await nextTick();
    await nextTick();
    const canvas = wrapper.get('[data-testid="heat-canvas"]').element as HTMLCanvasElement;
    if (canvas.width === 0) {
      await wrapper.setProps({ selectedUnit: 'l1' });
      await nextTick();
      await wrapper.setProps({ selectedUnit: 'ub' });
      await nextTick();
      await nextTick();
    }
    // Board fills via CSS inset — no stale inline width/height.
    expect(board.style.width).toBe('');
    expect(board.style.height).toBe('');
    expect(canvas.width).toBeGreaterThan(0);
    expect(canvas.height).toBeGreaterThan(0);
    wrapper.unmount();
    host.remove();
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
    // View-bar sits above the Access Count legend (DOM order).
    const viewBar = wrapper.get('[data-testid="heat-view-bar"]').element;
    const legend = wrapper.get('[data-testid="heat-legend"]').element;
    expect(viewBar.compareDocumentPosition(legend) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
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
    await nextTick(); // canvas repaint after view remount
    expect(wrapper.get('[data-testid="heat-unit-name"]').text()).toBe('Core 1 · AIV1 UB');
    expect(wrapper.get('[data-testid="heat-grid"]').attributes('aria-label')).toBe(
      '10 / 416 个块已用',
    );
    expect(wrapper.find('[data-testid="heat-canvas"]').exists()).toBe(true);
  });

  it('PR-HEAT-012: single-view tabs omit the view-bar (no reserved band above legend)', () => {
    const wrapper = mountPanel({ selectedUnit: 'l1' });
    expect(wrapper.find('[data-testid="heat-view-bar"]').exists()).toBe(false);
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

  /**
   * Stub a 2×4 lattice with 10px cells so pointermove hit-test is deterministic in jsdom.
   * Outer = border×2 + pad×2 + 2×10 + 1×gap = 4+4+20+2 = 30 wide; height 4 rows → 50.
   */
  function stubHeatGrid(wrapper: ReturnType<typeof mountPanel>, cols = 2, rows = 4, cell = 10) {
    const gap = 2;
    const pad = 2;
    const border = 2;
    const innerW = cols * cell + (cols - 1) * gap;
    const innerH = rows * cell + (rows - 1) * gap;
    const width = innerW + 2 * pad + 2 * border;
    const height = innerH + 2 * pad + 2 * border;
    const grid = wrapper.get('[data-testid="heat-grid"]');
    const el = grid.element as HTMLElement;
    el.getBoundingClientRect = () =>
      ({
        x: 0,
        y: 0,
        left: 0,
        top: 0,
        right: width,
        bottom: height,
        width,
        height,
        toJSON() {
          return {};
        },
      }) as DOMRect;
    return {
      grid,
      /** Client coords for the center of cell (col, row). */
      cellCenter(col: number, row: number) {
        const x = border + pad + col * (cell + gap) + cell / 2;
        const y = border + pad + row * (cell + gap) + cell / 2;
        return { clientX: x, clientY: y };
      },
      /** Client coords in the gap between col0 and col1 on row 0. */
      seamAfterCol0() {
        const x = border + pad + cell + gap / 2;
        const y = border + pad + cell / 2;
        return { clientX: x, clientY: y };
      },
    };
  }

  const tipFixture = {
    selectedUnit: 'ub' as const,
    model: {
      units: [
        {
          id: 'ub' as const,
          views: [
            view({
              memoryName: 'UB',
              columns: 2,
              rows: 4,
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
  };

  it('PR-HEAT-013: SA cell tip shows Start Address, Cell Size, Accesses Count + zoom overlay', async () => {
    const wrapper = mountPanel(
      { ...tipFixture, locale: 'zh-CN' },
      { attachTo: document.body },
    );
    // Lattice is canvas — no per-cell DOM / hover class; overlay owns the zoom tile.
    expect(wrapper.findAll('.pr-heat__cell')).toHaveLength(0);

    const { grid, cellCenter } = stubHeatGrid(wrapper);
    await grid.trigger('pointermove', cellCenter(0, 0));
    const hover = wrapper.get('[data-testid="heat-cell-hover"]');
    // Zoom tile paints the cell fill (jsdom may drop calc(var(--pr-heat-cell)) sizing).
    expect(hover.attributes('style')).toMatch(/background-color:\s*rgb\(/);
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
    expect((tip as HTMLElement).classList.contains('pr-tooltip')).toBe(true);

    // Seam move keeps sticky hover (geometry attributes gap to left cell).
    await grid.trigger('pointermove', stubHeatGrid(wrapper).seamAfterCol0());
    expect(wrapper.find('[data-testid="heat-cell-hover"]').exists()).toBe(true);
    expect(document.querySelector('[data-testid="heat-cell-tooltip"]')).not.toBeNull();

    await grid.trigger('pointerleave');
    expect(wrapper.find('[data-testid="heat-cell-hover"]').exists()).toBe(false);
    expect(document.querySelector('[data-testid="heat-cell-tooltip"]')).toBeNull();
    wrapper.unmount();
  });

  it('PR-HEAT-013: tip sticks across seams; switches only when hit-test lands on another cell', async () => {
    const wrapper = mountPanel(
      { ...tipFixture, locale: 'en' },
      { attachTo: document.body },
    );
    const { grid, cellCenter, seamAfterCol0 } = stubHeatGrid(wrapper);
    await grid.trigger('pointermove', cellCenter(0, 0));
    expect(wrapper.find('[data-testid="heat-cell-hover"]').exists()).toBe(true);
    expect(
      document.querySelector('[data-testid="heat-cell-tip-accesses-value"]')!.textContent,
    ).toBe('300,090');
    await grid.trigger('pointermove', seamAfterCol0());
    expect(
      document.querySelector('[data-testid="heat-cell-tip-accesses-value"]')!.textContent,
    ).toBe('300,090');
    await grid.trigger('pointermove', cellCenter(1, 0));
    expect(
      document.querySelector('[data-testid="heat-cell-tip-accesses-value"]')!.textContent,
    ).toBe('32');
    wrapper.unmount();
  });

  it('PR-HEAT-013: EN tip labels match SA Access Count', async () => {
    const wrapper = mountPanel(
      { ...tipFixture, locale: 'en' },
      { attachTo: document.body },
    );
    const { grid, cellCenter } = stubHeatGrid(wrapper);
    await grid.trigger('pointermove', cellCenter(0, 0));
    const tip = document.querySelector('[data-testid="heat-cell-tooltip"]');
    expect(tip!.textContent).toContain('Start Address');
    expect(tip!.textContent).toContain('Cell Size');
    expect(tip!.textContent).toContain('Access Count');
    expect(tip!.querySelector('[data-testid="heat-cell-tip-address-value"]')!.textContent).toBe(
      '0x100',
    );
    wrapper.unmount();
  });

  it('PR-HEAT-013: tip and hover clear when the active view changes', async () => {
    const wrapper = mountPanel(
      {
        locale: 'en',
        selectedUnit: 'ub',
        model: {
          units: [
            {
              id: 'ub',
              views: [
                view({
                  memoryName: 'UB',
                  ownerName: 'AIV0',
                  columns: 2,
                  rows: 4,
                  cellSize: 128,
                  baseAddress: 0x100,
                  blocks: blocks(8, 2),
                }),
                view({
                  memoryName: 'UB',
                  ownerName: 'AIV1',
                  coreTypeId: 3,
                  columns: 2,
                  rows: 4,
                  cellSize: 128,
                  baseAddress: 0x200,
                  blocks: blocks(8, 1),
                }),
              ],
            },
          ],
        },
      },
      { attachTo: document.body },
    );
    const { grid, cellCenter } = stubHeatGrid(wrapper);
    await grid.trigger('pointermove', cellCenter(0, 0));
    expect(document.querySelector('[data-testid="heat-cell-tip-address-value"]')!.textContent).toBe(
      '0x100',
    );
    await wrapper.get('[data-testid="heat-view-select"]').trigger('click');
    const item = document.querySelector(
      '[data-testid="heat-view-select-menu"] [data-value="1"]',
    ) as HTMLElement | null;
    expect(item).not.toBeNull();
    item!.click();
    await nextTick();
    expect(document.querySelector('[data-testid="heat-cell-tooltip"]')).toBeNull();
    expect(wrapper.find('[data-testid="heat-cell-hover"]').exists()).toBe(false);
    wrapper.unmount();
  });

  it('PR-HEAT-013: hover zoom tile tracks a lattice resize', async () => {
    const callbacks: ResizeObserverCallback[] = [];
    const realRO = globalThis.ResizeObserver;
    class FakeResizeObserver {
      constructor(cb: ResizeObserverCallback) {
        callbacks.push(cb);
      }
      observe() {}
      unobserve() {}
      disconnect() {}
    }
    vi.stubGlobal('ResizeObserver', FakeResizeObserver);
    const wrapper = mountPanel({ ...tipFixture, locale: 'en' }, { attachTo: document.body });
    try {
      const board = wrapper.get('[data-testid="heat-board"]').element as HTMLElement;
      Object.defineProperty(board, 'clientWidth', { configurable: true, get: () => 0 });
      Object.defineProperty(board, 'clientHeight', { configurable: true, get: () => 0 });
      const { grid, cellCenter } = stubHeatGrid(wrapper);
      await nextTick();
      await grid.trigger('pointermove', cellCenter(0, 0));
      const before = wrapper.get('[data-testid="heat-cell-hover"]').attributes('style') ?? '';
      const widthBefore = Number(before.match(/width:\s*([\d.]+)px/)?.[1]);
      stubHeatGrid(wrapper, 2, 4, 20);
      expect(callbacks.length).toBeGreaterThan(0);
      callbacks[0]!([], {} as ResizeObserver);
      await nextTick();
      const after = wrapper.get('[data-testid="heat-cell-hover"]').attributes('style') ?? '';
      const widthAfter = Number(after.match(/width:\s*([\d.]+)px/)?.[1]);
      expect(widthAfter).toBeGreaterThan(widthBefore);
    } finally {
      wrapper.unmount();
      if (realRO) vi.stubGlobal('ResizeObserver', realRO);
      else vi.unstubAllGlobals();
    }
  });

  /** Stub the painted track rect (pointer % maps here; hit has ±5% side pads). */
  function stubLegendTrack(wrapper: ReturnType<typeof mountPanel>, trackWidth = 200, pad = 10) {
    const track = wrapper.get('[data-testid="heat-legend-track"]').element as HTMLElement;
    track.getBoundingClientRect = () =>
      ({
        x: pad,
        y: 0,
        left: pad,
        top: 0,
        right: pad + trackWidth,
        bottom: 22,
        width: trackWidth,
        height: 22,
        toJSON() {
          return {};
        },
      }) as DOMRect;
    return { trackWidth, pad, hitLeft: 0, hitRight: pad * 2 + trackWidth };
  }

  it('PR-HEAT-014: legend brush (10%) mutes via veil + bright canvas; clears on leave', async () => {
    // Two hot cells: intensities 0.5 and 1.0 → mid brush (~45–55%) keeps only the 0.5 cell bright.
    const brushModel: MemoryHeatmapModel = {
      units: [
        {
          id: 'ub',
          views: [
            view({
              columns: 2,
              rows: 2,
              blocks: [
                { index: 0, state: 'withData', intensity: 0.5, accessCount: 50 },
                { index: 1, state: 'withData', intensity: 1, accessCount: 100 },
                { index: 2, state: 'withoutData', intensity: 0, accessCount: 0 },
                { index: 3, state: 'withoutData', intensity: 0, accessCount: 0 },
              ],
            }),
          ],
        },
      ],
    };
    const wrapper = mountPanel({ model: brushModel, selectedUnit: 'ub', locale: 'en' });
    await nextTick(); // canvas paint after mount
    const gradient = wrapper.get('[data-testid="heat-legend-gradient"]');
    const { trackWidth, pad, hitLeft, hitRight } = stubLegendTrack(wrapper);

    // Mid-strip → center 50%, window [45, 55]. Enter applies sync (no rAF).
    await gradient.trigger('pointermove', { clientX: pad + trackWidth / 2, clientY: 11 });
    const brush = wrapper.get('[data-testid="heat-legend-brush"]');
    expect(brush.attributes('hidden')).toBeUndefined();
    expect(brush.attributes('style')).toMatch(/left:\s*45%/);
    expect(brush.attributes('style')).toMatch(/width:\s*10%/);
    expect(wrapper.get('[data-testid="heat-legend-title"]').text()).toBe('Access Count');
    expect(wrapper.get('[data-testid="heat-legend-brush-range"]').text()).toBe('45 – 55');
    // Mid brush: both end ticks fully visible.
    expect(wrapper.get('[data-testid="heat-legend-tick-min"]').attributes('style')).toMatch(
      /opacity:\s*1/,
    );
    expect(wrapper.get('[data-testid="heat-legend-tick-max"]').attributes('style')).toMatch(
      /opacity:\s*1/,
    );

    // Heat dim: lattice veil canvas + bright canvas; base canvas stays mounted.
    const veil = wrapper.get('[data-testid="heat-mute-veil"]');
    expect(veil.element.tagName).toBe('CANVAS');
    expect(veil.classes()).toContain('pr-heat__mute-veil--on');
    expect(wrapper.find('[data-testid="heat-canvas"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="heat-canvas-bright"]').exists()).toBe(true);
    // Mid brush [45, 55] catches intensity 0.5 only → match tip shows.
    const match = wrapper.get('[data-testid="heat-legend-brush-match"]');
    expect(match.attributes('hidden')).toBeUndefined();
    expect(match.text()).toBe('1 cells');

    // Strip left edge → center 0%, window [-5, 5]; label coerces to 0 – 5.
    await gradient.trigger('pointermove', { clientX: pad, clientY: 11 });
    await flushLegendBrushFrame();
    expect(wrapper.get('[data-testid="heat-legend-brush"]').attributes('style')).toMatch(
      /left:\s*-5%/,
    );
    expect(wrapper.get('[data-testid="heat-legend-brush-range"]').text()).toBe('0 – 5');
    expect(match.text()).toBe('2 cells'); // intensity 0 cells
    expect(wrapper.get('[data-testid="heat-legend-tick-min"]').attributes('style')).toMatch(
      /opacity:\s*0/,
    );
    expect(wrapper.get('[data-testid="heat-legend-tick-max"]').attributes('style')).toMatch(
      /opacity:\s*1/,
    );

    // Left side pad (outside strip) → center -5%, window [-10, 0]; label 0 – 0.
    await gradient.trigger('pointermove', { clientX: hitLeft, clientY: 11 });
    await flushLegendBrushFrame();
    expect(wrapper.get('[data-testid="heat-legend-brush"]').attributes('style')).toMatch(
      /left:\s*-10%/,
    );
    expect(wrapper.get('[data-testid="heat-legend-brush-range"]').text()).toBe('0 – 0');
    expect(match.text()).toBe('2 cells');

    // Strip right edge → window [95, 105]; label 95 – 100.
    await gradient.trigger('pointermove', { clientX: pad + trackWidth, clientY: 11 });
    await flushLegendBrushFrame();
    expect(wrapper.get('[data-testid="heat-legend-brush"]').attributes('style')).toMatch(
      /left:\s*95%/,
    );
    expect(wrapper.get('[data-testid="heat-legend-brush-range"]').text()).toBe('95 – 100');
    expect(match.text()).toBe('1 cells');
    expect(wrapper.get('[data-testid="heat-legend-tick-min"]').attributes('style')).toMatch(
      /opacity:\s*1/,
    );
    expect(wrapper.get('[data-testid="heat-legend-tick-max"]').attributes('style')).toMatch(
      /opacity:\s*0/,
    );

    // Right side pad → center 105%, window [100, 110]; label 100 – 100.
    await gradient.trigger('pointermove', { clientX: hitRight, clientY: 11 });
    await flushLegendBrushFrame();
    expect(wrapper.get('[data-testid="heat-legend-brush"]').attributes('style')).toMatch(
      /left:\s*100%/,
    );
    expect(wrapper.get('[data-testid="heat-legend-brush-range"]').text()).toBe('100 – 100');
    expect(match.text()).toBe('1 cells');

    // Gap between 0 and 0.5 → center 25%, window [20, 30]; no cells → tip hidden.
    await gradient.trigger('pointermove', { clientX: pad + trackWidth * 0.25, clientY: 11 });
    await flushLegendBrushFrame();
    expect(wrapper.get('[data-testid="heat-legend-brush-range"]').text()).toBe('20 – 30');
    expect(match.attributes('hidden')).toBe('');
    expect(match.text()).toBe('');

    // Occupancy dim: mute overlay + three ≥3px bright bands (fade via --brushing class).
    const gradientEl = wrapper.get('.pr-heat__gradient');
    expect(gradientEl.classes()).toContain('pr-heat__gradient--brushing');
    expect(gradientEl.attributes('style')).toMatch(/linear-gradient/);
    expect(wrapper.find('[data-testid="heat-legend-mute"]').exists()).toBe(true);
    const occ = wrapper.findAll('[data-testid="heat-legend-occ"]');
    expect(occ).toHaveLength(3);
    for (const band of occ) {
      const style = band.attributes('style') ?? '';
      expect(style).toMatch(/width:\s*[\d.]+%/);
      const widthMatch = style.match(/width:\s*([\d.]+)%/);
      expect(Number(widthMatch?.[1])).toBeGreaterThanOrEqual(1.5); // 3px / 200px
      expect(style).toMatch(/background-image:/);
    }

    // Leave: brush chrome (+ match tip) hides before fades; veil starts fade; bright canvas stays.
    await gradient.trigger('pointerleave');
    expect(brush.attributes('hidden')).toBe('');
    expect(match.attributes('hidden')).toBe('');
    expect(veil.classes()).not.toContain('pr-heat__mute-veil--on');
    expect(wrapper.get('.pr-heat__gradient').classes()).not.toContain('pr-heat__gradient--brushing');
    expect(wrapper.find('[data-testid="heat-canvas-bright"]').exists()).toBe(true);
    await veil.trigger('transitionend', { propertyName: 'opacity' });
    // Bands stay mounted so opacity can fade out.
    expect(wrapper.findAll('[data-testid="heat-legend-occ"]')).toHaveLength(3);
    expect(wrapper.get('.pr-heat__gradient').attributes('style')).toMatch(/linear-gradient/);
    expect(wrapper.get('.pr-heat__gradient').attributes('style')).toMatch(/#AFC6FE/i);
    expect(wrapper.get('[data-testid="heat-legend-title"]').text()).toBe('Access Count');
  });

  it('PR-HEAT-014: single unique intensity paints one ≥3px occupancy band', async () => {
    const singleModel: MemoryHeatmapModel = {
      units: [
        {
          id: 'ub',
          views: [
            view({
              columns: 2,
              rows: 1,
              blocks: [
                { index: 0, state: 'withData', intensity: 0.4, accessCount: 40 },
                { index: 1, state: 'withData', intensity: 0.4, accessCount: 40 },
              ],
            }),
          ],
        },
      ],
    };
    const wrapper = mountPanel({ model: singleModel, selectedUnit: 'ub', locale: 'en' });
    await nextTick();
    const gradient = wrapper.get('[data-testid="heat-legend-gradient"]');
    const { trackWidth, pad } = stubLegendTrack(wrapper);

    await gradient.trigger('pointermove', { clientX: pad + trackWidth / 2, clientY: 11 });
    const occ = wrapper.findAll('[data-testid="heat-legend-occ"]');
    expect(occ).toHaveLength(1);
    const style = occ[0]!.attributes('style') ?? '';
    const widthMatch = style.match(/width:\s*([\d.]+)%/);
    expect(Number(widthMatch?.[1])).toBeCloseTo(1.5, 5);
    wrapper.unmount();
  });

  it('PR-HEAT-014: match count uses the same integer span as the range label', async () => {
    // max 3, mid window 45–55% rounds to 1–2. Percent membership would highlight nothing.
    const odd: MemoryHeatmapModel = {
      units: [
        {
          id: 'ub',
          views: [
            view({
              columns: 2,
              rows: 2,
              blocks: [
                { index: 0, state: 'withData', intensity: 1 / 3, accessCount: 1 },
                { index: 1, state: 'withData', intensity: 2 / 3, accessCount: 2 },
                { index: 2, state: 'withData', intensity: 1, accessCount: 3 },
                { index: 3, state: 'withoutData', intensity: 0, accessCount: 0 },
              ],
            }),
          ],
        },
      ],
    };
    const wrapper = mountPanel({ model: odd, selectedUnit: 'ub', locale: 'en' });
    await nextTick();
    const gradient = wrapper.get('[data-testid="heat-legend-gradient"]');
    const { trackWidth, pad } = stubLegendTrack(wrapper);
    await gradient.trigger('pointermove', { clientX: pad + trackWidth / 2, clientY: 11 });
    expect(wrapper.get('[data-testid="heat-legend-brush-range"]').text()).toBe('1 – 2');
    expect(wrapper.get('[data-testid="heat-legend-brush-match"]').text()).toBe('2 cells');

    const { grid, cellCenter } = stubHeatGrid(wrapper, 2, 2);
    await grid.trigger('pointermove', cellCenter(0, 0));
    expect(wrapper.find('[data-testid="heat-cell-hover"]').exists()).toBe(true);
    await grid.trigger('pointermove', cellCenter(0, 1));
    expect(wrapper.find('[data-testid="heat-cell-hover"]').exists()).toBe(false);
    wrapper.unmount();
  });

  it('PR-HEAT-014: hover tile returns after the brush veil fades', async () => {
    const brushModel: MemoryHeatmapModel = {
      units: [
        {
          id: 'ub',
          views: [
            view({
              columns: 2,
              rows: 2,
              blocks: [
                { index: 0, state: 'withData', intensity: 0.5, accessCount: 50 },
                { index: 1, state: 'withData', intensity: 1, accessCount: 100 },
                { index: 2, state: 'withoutData', intensity: 0, accessCount: 0 },
                { index: 3, state: 'withoutData', intensity: 0, accessCount: 0 },
              ],
            }),
          ],
        },
      ],
    };
    const wrapper = mountPanel({ model: brushModel, selectedUnit: 'ub', locale: 'en' });
    await nextTick();
    const gradient = wrapper.get('[data-testid="heat-legend-gradient"]');
    const { trackWidth, pad } = stubLegendTrack(wrapper);
    await gradient.trigger('pointermove', { clientX: pad + trackWidth / 2, clientY: 11 });
    const { grid, cellCenter } = stubHeatGrid(wrapper, 2, 2);
    // Count 100 is outside the 45–55 window, so the tile stays off while the brush is live.
    await grid.trigger('pointermove', cellCenter(1, 0));
    expect(wrapper.find('[data-testid="heat-cell-hover"]').exists()).toBe(false);
    await gradient.trigger('pointerleave');
    expect(wrapper.find('[data-testid="heat-cell-hover"]').exists()).toBe(false);
    await wrapper.get('[data-testid="heat-mute-veil"]').trigger('transitionend', { propertyName: 'opacity' });
    await nextTick();
    expect(wrapper.find('[data-testid="heat-cell-hover"]').exists()).toBe(true);
    wrapper.unmount();
  });
});
