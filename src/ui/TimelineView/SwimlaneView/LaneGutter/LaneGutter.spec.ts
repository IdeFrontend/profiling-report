import { describe, expect, it, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import LaneGutter from './LaneGutter.vue';

/** One rule's declarations from the raw SFC. Scoped so comment prose — which cites the
 *  old values on purpose — cannot satisfy or break a negative assertion. */
const rule = (src: string, selector: string): string =>
  src.match(new RegExp(`${selector}\\s*\\{([^}]*)\\}`))?.[1] ?? '';

const groups = [
  {
    id: 'p1',
    name: 'Process 1',
    lanes: [
      { id: 'l1', name: 'Thread A', color: '#f00', utilization: 0.75 },
      { id: 'l2', name: 'Thread B', color: '#0f0', utilization: 0.25 },
    ],
  },
];

describe('LaneGutter', () => {
  it('PR-GUTTER-001: renders lane names for each group', () => {
    const wrapper = mount(LaneGutter, {
      props: { groups },
    });

    expect(wrapper.find('[data-testid="lane-gutter"]').exists()).toBe(true);
    expect(wrapper.text()).toContain('Thread A');
  });

  it('PR-GUTTER-002: shows utilization percent; ≥50% fill is gray not lane.color', () => {
    const wrapper = mount(LaneGutter, {
      props: { groups },
    });

    const util = wrapper.find('[data-testid="lane-util"]');
    expect(util.exists()).toBe(true);
    expect(util.text()).toContain('75%');
    expect(util.classes()).toContain('pr-gutter__util--thick');
    expect(util.find('.pr-gutter__util-pct').exists()).toBe(true);
    const fill = util.find('.pr-gutter__util-fill');
    expect(fill.exists()).toBe(true);
    expect(fill.attributes('style')).toContain('--pr-util-fill: rgba(255, 255, 255, 0.08)');
  });

  it('PR-GUTTER-002b: util <50% fill is red', () => {
    const wrapper = mount(LaneGutter, {
      props: { groups },
    });
    const fills = wrapper.findAll('.pr-gutter__util-fill');
    expect(fills[1]!.attributes('style')).toContain('--pr-util-fill: rgba(231, 67, 74, 0.4)');
  });

  it('PR-GUTTER-003: nested folders show chevrons; leaf lanes have no chevron; folder click toggles', async () => {
    const nested = [
      {
        id: 'card0',
        name: 'Card0',
        lanes: [
          {
            id: 'compute',
            name: '计算',
            color: '#007084',
            utilization: 0.9,
            children: [{ id: 'mte1', name: 'MTE1', color: '#885C00', utilization: 0.5 }],
          },
          { id: 'leaf', name: '通信', color: '#888', utilization: 1 },
        ],
      },
    ];
    const wrapper = mount(LaneGutter, {
      props: { groups: nested, collapsedIds: [] },
    });

    expect(wrapper.text()).not.toMatch(/[▾▸▲▼▶◀]/);
    expect(wrapper.find('[data-testid="gutter-folder-compute"] .pr-gutter__chevron').exists()).toBe(
      true,
    );
    expect(wrapper.find('[data-testid="gutter-lane-leaf"] .pr-gutter__chevron').exists()).toBe(false);

    await wrapper.get('[data-testid="gutter-folder-compute"]').trigger('click');
    expect(wrapper.emitted('toggle-group')?.[0]).toEqual(['compute']);
  });

  it('PR-GUTTER-004: collapsed Card hides child lanes; spacer remains', () => {
    const wrapper = mount(LaneGutter, {
      props: { groups, collapsedIds: ['p1'] },
    });

    expect(wrapper.find('[data-testid="gutter-group-p1"]').exists()).toBe(true);
    expect(wrapper.text()).not.toContain('Thread A');
  });

  it('PR-GUTTER-005: nested folder chevron + collapse keeps folder row', async () => {
    const nested = [
      {
        id: 'card0',
        name: 'Card0',
        lanes: [
          { id: 'comm', name: '通信', color: '#888', utilization: 1 },
          {
            id: 'compute',
            name: '计算',
            color: '#007084',
            utilization: 0.9,
            children: [
              {
                id: 'cube',
                name: 'Core0.Cube',
                color: '#007084',
                utilization: 0.8,
                children: [{ id: 'mte1', name: 'MTE1', color: '#885C00', utilization: 0.5 }],
              },
            ],
          },
        ],
      },
    ];
    const wrapper = mount(LaneGutter, {
      props: { groups: nested, collapsedIds: [] },
    });
    expect(wrapper.text()).toContain('计算');
    expect(wrapper.text()).toContain('Core0.Cube');
    expect(wrapper.text()).toContain('MTE1');
    expect(wrapper.find('[data-testid="gutter-folder-compute"] .pr-gutter__chevron').exists()).toBe(
      true,
    );

    await wrapper.get('[data-testid="gutter-folder-cube"]').trigger('click');
    expect(wrapper.emitted('toggle-group')?.[0]).toEqual(['cube']);

    const collapsed = mount(LaneGutter, {
      props: { groups: nested, collapsedIds: ['cube'] },
    });
    expect(collapsed.text()).toContain('Core0.Cube');
    expect(collapsed.text()).not.toContain('MTE1');
  });

  it('PR-GUTTER-006: thick folder/depth-0 bars; thin pipe leaf under Core', async () => {
    const nested = [
      {
        id: 'card0',
        name: 'Card0',
        lanes: [
          { id: 'comm', name: '通信', color: '#f00', utilization: 1 },
          {
            id: 'compute',
            name: '计算',
            color: '#0f0',
            utilization: 0.9,
            children: [
              {
                id: 'cube',
                name: 'Core0.Cube',
                color: '#00f',
                utilization: 0.8,
                children: [{ id: 'mte1', name: 'MTE1', color: '#885C00', utilization: 0.37 }],
              },
            ],
          },
        ],
      },
    ];
    const wrapper = mount(LaneGutter, {
      props: { groups: nested, collapsedIds: [] },
    });
    expect(wrapper.get('[data-testid="gutter-lane-comm"] [data-testid="lane-util"]').classes()).toContain(
      'pr-gutter__util--thick',
    );
    expect(
      wrapper.get('[data-testid="gutter-folder-compute"] [data-testid="lane-util"]').classes(),
    ).toContain('pr-gutter__util--thick');
    expect(
      wrapper.get('[data-testid="gutter-folder-cube"] [data-testid="lane-util"]').classes(),
    ).toContain('pr-gutter__util--thick');
    const leafUtil = wrapper.get('[data-testid="gutter-lane-mte1"] [data-testid="lane-util"]');
    expect(leafUtil.classes()).toContain('pr-gutter__util--thin');
    expect(leafUtil.find('.pr-gutter__util-pct').exists()).toBe(false);
    expect(leafUtil.find('.pr-gutter__util-fill').attributes('style')).toContain(
      '--pr-util-fill: rgba(231, 67, 74, 0.4)',
    );

    const src = (await import('./LaneGutterNode.vue?raw')).default as string;
    // Radius follows the bar's height; 4px on the 8px bar rounds it into a stadium.
    expect(rule(src, '\\.pr-gutter__util--thin')).toMatch(/border-radius:\s*2px/);
    expect(rule(src, '\\.pr-gutter__util')).toMatch(/border-radius:\s*4px/);
    // Opaque under the tint, so the track hatch cannot read through the filled part.
    const fillRule = rule(src, '\\.pr-gutter__util-fill');
    expect(fillRule).toMatch(/background-color:\s*var\(--pr-util-track\)/);
    expect(fillRule).toMatch(/background-image:\s*linear-gradient\(var\(--pr-util-fill\)/);
  });

  it('PR-GUTTER-007: filled util has 50% midline; empty util does not', () => {
    const wrapper = mount(LaneGutter, {
      props: {
        groups: [
          {
            id: 'p1',
            name: 'Process 1',
            utilMidlinePercent: 50,
            lanes: [
              { id: 'a', name: 'A', color: '#f00', utilization: 0.46 },
              { id: 'b', name: 'B', color: '#0f0' },
            ],
          },
        ],
      },
    });
    const mid = wrapper.get('[data-testid="gutter-lane-a"] [data-testid="lane-util"]').find('.pr-gutter__util-mid');
    expect(mid.exists()).toBe(true);
    expect(mid.attributes('style')).toContain('left: 50%');
    expect(wrapper.get('[data-testid="gutter-lane-b"] .pr-gutter__util--empty').find('.pr-gutter__util-mid').exists()).toBe(
      false,
    );
  });

  it('PR-GUTTER-007b: relative metric midline uses averageBarWidth', () => {
    const wrapper = mount(LaneGutter, {
      props: {
        groups: [
          {
            id: 'p1',
            name: 'Process 1',
            utilMidlinePercent: 75,
            lanes: [
              {
                id: 'l1',
                name: 'Thread A',
                color: '#f00',
                bar: { barWidth: 100, label: '10', relativeMax: true },
              },
            ],
          },
        ],
      },
    });
    const mid = wrapper.get('.pr-gutter__util-mid');
    expect(mid.attributes('style')).toContain('left: 75%');
  });

  it('PR-GUTTER-006b: relativeMax drives red fill; tied bars stay gray', () => {
    const wrapper = mount(LaneGutter, {
      props: {
        groups: [
          {
            id: 'p1',
            name: 'Process 1',
            lanes: [
              { id: 'max', name: 'Max', color: '#f00', bar: { barWidth: 100, label: '10', relativeMax: true } },
              { id: 'other', name: 'Other', color: '#0f0', bar: { barWidth: 50, label: '5', relativeMax: false } },
              { id: 'tie', name: 'Tie', color: '#00f', bar: { barWidth: 100, label: '10', relativeMax: false } },
            ],
          },
        ],
      },
    });
    const fills = wrapper.findAll('.pr-gutter__util-fill');
    expect(fills[0]!.attributes('style')).toContain('--pr-util-fill: rgba(231, 67, 74, 0.4)');
    expect(fills[1]!.attributes('style')).toContain('--pr-util-fill: rgba(255, 255, 255, 0.08)');
    expect(fills[2]!.attributes('style')).toContain('--pr-util-fill: rgba(255, 255, 255, 0.08)');
  });

  it('PR-GUTTER-008: Card row is a non-interactive spacer', () => {
    const wrapper = mount(LaneGutter, {
      props: { groups },
    });
    const spacer = wrapper.get('[data-testid="gutter-group-p1"]');
    expect(spacer.element.tagName).toBe('DIV');
    expect(spacer.attributes('aria-hidden')).toBe('true');
    expect(spacer.find('button').exists()).toBe(false);
  });

  it('PR-GUTTER-010: leaf rows include pushpin; unpinned hover-only; pinned always visible', async () => {
    const nested = [
      {
        id: 'card0',
        name: 'Card0',
        lanes: [
          {
            id: 'compute',
            name: '计算',
            color: '#007084',
            utilization: 0.9,
            children: [{ id: 'mte1', name: 'MTE1', color: '#885C00', utilization: 0.5 }],
          },
          { id: 'leaf', name: '通信', color: '#888', utilization: 1 },
        ],
      },
    ];
    const wrapper = mount(LaneGutter, {
      props: { groups: nested, pinnedLaneIds: ['mte1'] },
      attachTo: document.body,
    });
    wrapper.get('[data-testid="gutter-lane-leaf"] [data-testid="lane-pin"]');
    wrapper.get('[data-testid="gutter-lane-mte1"] [data-testid="lane-pin"]');
    expect(wrapper.get('[data-testid="gutter-lane-leaf"]').classes()).not.toContain(
      'pr-gutter__lane--pinned',
    );
    expect(wrapper.get('[data-testid="gutter-lane-mte1"]').classes()).toContain(
      'pr-gutter__lane--pinned',
    );
    expect(wrapper.find('[data-testid="gutter-folder-compute"] [data-testid="lane-pin"]').exists()).toBe(
      false,
    );
    expect(wrapper.get('[data-testid="gutter-group-card0"]').find('[data-testid="lane-pin"]').exists()).toBe(
      false,
    );

    await wrapper.setProps({ hoveredLaneId: 'leaf' });
    expect(wrapper.get('[data-testid="gutter-lane-leaf"]').classes()).toContain(
      'pr-gutter__lane--lane-hover',
    );
    wrapper.unmount();
  });

  it('PR-GUTTER-011: flush-left pin; outline when unpinned, solid when pinned or pin-hovered', async () => {
    const nested = [
      {
        id: 'card0',
        name: 'Card0',
        lanes: [
          {
            id: 'compute',
            name: '计算',
            color: '#007084',
            utilization: 0.9,
            children: [
              { id: 'mte1', name: 'MTE1', color: '#885C00', utilization: 0.5 },
              { id: 'mte2', name: 'MTE2', color: '#885C00', utilization: 0.5 },
            ],
          },
        ],
      },
    ];
    const wrapper = mount(LaneGutter, {
      props: { groups: nested, pinnedLaneIds: ['mte1'] },
      attachTo: document.body,
    });
    // Flush-left geometry is CSS (`left: 6px`); assert fill state here — layout in Playwright e2e.
    const deepPin = wrapper.get('[data-testid="gutter-lane-mte1"] [data-testid="lane-pin"]');
    expect(deepPin.find('.pr-pin--filled').exists()).toBe(true);

    const unpinned = wrapper.get('[data-testid="gutter-lane-mte2"] [data-testid="lane-pin"]');
    expect(unpinned.find('.pr-pin--filled').exists()).toBe(false);
    await unpinned.trigger('pointerenter');
    expect(unpinned.find('.pr-pin--filled').exists()).toBe(true);
    wrapper.unmount();
  });

  it('PR-GUTTER-012: pushpin hover/focus shows localized pin tooltip', async () => {
    const wrapper = mount(LaneGutter, {
      props: { groups, locale: 'en' },
    });
    const pin = wrapper.get('[data-testid="gutter-lane-l1"] [data-testid="lane-pin"]');
    expect(pin.attributes('aria-label')).toBe('Pin to top');
    expect(pin.find('.pr-gutter__pin-tip').exists()).toBe(false);
    await pin.trigger('pointerenter');
    expect(pin.find('.pr-gutter__pin-tip').text()).toBe('Pin to top');

    await wrapper.setProps({ locale: 'zh-CN' });
    expect(wrapper.get('[data-testid="gutter-lane-l1"] [data-testid="lane-pin"]').attributes('aria-label')).toBe(
      '置顶',
    );
  });

  it('PR-GUTTER-014: categoryKey localizes card folder / spacer labels', async () => {
    const nested = [
      {
        id: 'card0',
        name: 'Card0',
        lanes: [
          { id: 'comm', name: '通信', categoryKey: 'comm' as const, color: '#888', utilization: 1 },
          {
            id: 'compute',
            name: '计算',
            categoryKey: 'compute' as const,
            color: '#007084',
            utilization: 0.9,
            children: [{ id: 'mte1', name: 'MTE1', color: '#885C00', utilization: 0.5 }],
          },
          { id: 'hbm', name: '储存HBM', categoryKey: 'hbm' as const, color: '#888', utilization: 0.46 },
        ],
      },
    ];
    const wrapper = mount(LaneGutter, {
      props: { groups: nested, locale: 'en' },
    });
    expect(wrapper.text()).toContain('Comm');
    expect(wrapper.text()).toContain('Compute');
    expect(wrapper.text()).toContain('HBM storage');
    expect(wrapper.text()).not.toContain('通信');

    await wrapper.setProps({ locale: 'zh-CN' });
    expect(wrapper.text()).toContain('通信');
    expect(wrapper.text()).toContain('计算');
    expect(wrapper.text()).toContain('储存HBM');
  });

  it('PR-GUTTER-013: click unpinned pin emits pin-lane; pinned emits unpin-lane', async () => {
    const wrapper = mount(LaneGutter, {
      props: { groups, pinnedLaneIds: ['l1'] },
    });
    await wrapper.get('[data-testid="gutter-lane-l2"] [data-testid="lane-pin"]').trigger('click');
    expect(wrapper.emitted('pin-lane')?.[0]).toEqual(['l2']);
    await wrapper.get('[data-testid="gutter-lane-l1"] [data-testid="lane-pin"]').trigger('click');
    expect(wrapper.emitted('unpin-lane')?.[0]).toEqual(['l1']);
  });

  it('PR-GUTTER-009: bar payload drives width and label', () => {
    const wrapper = mount(LaneGutter, {
      props: {
        groups: [
          {
            id: 'p1',
            name: 'Process 1',
            lanes: [
              {
                id: 'l1',
                name: 'Thread A',
                color: '#f00',
                bar: { barWidth: 80, label: '12345', thresholdColor: false },
              },
            ],
          },
        ],
      },
    });
    const util = wrapper.get('[data-testid="lane-util"]');
    expect(util.find('.pr-gutter__util-fill').attributes('style')).toContain('width: 80%');
    expect(util.text()).toContain('12345');
    expect(util.text()).not.toContain('%');
  });

  it('PR-GUTTER-015: row hover fills the raised surface and lifts the label to white', async () => {
    const src = (await import('./LaneGutterNode.vue?raw')).default as string;

    // Both UCD crops measure #363636, not the value the pin slice first shipped.
    const hover = rule(src, '\\.pr-gutter__lane:hover,\\s*\\.pr-gutter__lane--lane-hover');
    expect(hover).toMatch(/--pr-surface-raised, #363636/);
    expect(hover).not.toMatch(/#252525/);

    // AC-19's second bullet: hover changes the label colour too.
    expect(
      rule(
        src,
        '\\.pr-gutter__lane:hover \\.pr-gutter__name,\\s*\\.pr-gutter__lane--lane-hover \\.pr-gutter__name',
      ),
    ).toMatch(/color:\s*#fff/);

    // Shared tip chrome (pin + util) follows EventTooltip / raised-surface token.
    const tip = rule(src, '\\.pr-gutter__tip');
    expect(tip).toMatch(/--pr-surface-raised, #363636/);
    expect(tip).not.toMatch(/#555/);
  });

  it('PR-GUTTER-016: thin lane hover shows delayed cursor-follow value tooltip', async () => {
    vi.useFakeTimers();
    const nested = [
      {
        id: 'card0',
        name: 'Card0',
        lanes: [
          {
            id: 'cube',
            name: 'Core0.Cube',
            color: '#007084',
            bar: { barWidth: 80, label: '88', thresholdColor: false },
            children: [
              {
                id: 'mte1',
                name: 'MTE1',
                color: '#885C00',
                bar: { barWidth: 40, label: '42', thresholdColor: false },
              },
            ],
          },
        ],
      },
    ];
    const wrapper = mount(LaneGutter, {
      props: { groups: nested, collapsedIds: [] },
      attachTo: document.body,
    });

    const thickLane = wrapper.get('[data-testid="gutter-folder-cube"]');
    expect(thickLane.get('[data-testid="lane-util"]').text()).toContain('88');
    await thickLane.trigger('pointerenter', { clientX: 40, clientY: 20 });
    await vi.advanceTimersByTimeAsync(400);
    expect(document.querySelector('[data-testid="lane-util-tip"]')).toBeNull();

    const thinLane = wrapper.get('[data-testid="gutter-lane-mte1"]');
    expect(thinLane.get('[data-testid="lane-util"]').classes()).toContain('pr-gutter__util--thin');
    expect(thinLane.find('.pr-gutter__util-pct').exists()).toBe(false);

    await thinLane.trigger('pointerenter', { clientX: 100, clientY: 50 });
    expect(document.querySelector('[data-testid="lane-util-tip"]')).toBeNull();
    await vi.advanceTimersByTimeAsync(399);
    expect(document.querySelector('[data-testid="lane-util-tip"]')).toBeNull();
    await vi.advanceTimersByTimeAsync(1);

    const tip = document.querySelector('[data-testid="lane-util-tip"]') as HTMLElement | null;
    expect(tip).toBeTruthy();
    expect(tip!.textContent).toBe('42');
    expect(tip!.style.left).toBe('112px');
    expect(tip!.style.top).toBe('62px');

    await thinLane.trigger('pointermove', { clientX: 130, clientY: 70 });
    expect(tip!.style.left).toBe('142px');
    expect(tip!.style.top).toBe('82px');

    await thinLane.trigger('pointerleave');
    expect(document.querySelector('[data-testid="lane-util-tip"]')).toBeNull();
    wrapper.unmount();
    vi.useRealTimers();
  });
});
