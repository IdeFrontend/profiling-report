import { describe, expect, it, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import { COUNTER_LANE_HEIGHT, LANE_GROUP_HEADER_HEIGHT, LANE_HEIGHT } from '../../../../swimlane/layout';
import LaneGutter from './LaneGutter.vue';
import {
  GUTTER_VIRTUALIZE_AFTER_GROUPS,
  gutterGroupBands,
  shouldVirtualizeGutter,
  windowGutterGroups,
} from './gutterWindow';

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

  it('PR-GUTTER-021: off-screen rows skip layout with an exact intrinsic height', () => {
    const wrapper = mount(LaneGutter, { props: { groups } });
    const lane = wrapper.get('[data-testid="gutter-lane-l1"]').attributes('style') ?? '';
    expect(lane).toContain('content-visibility: auto');
    expect(lane).toContain('contain-intrinsic-size: auto 22px');
    const group = wrapper.get('[data-testid="gutter-group-p1"]').attributes('style') ?? '';
    expect(group).toContain('content-visibility: auto');
    expect(group).toContain('contain-intrinsic-size: auto 40px');
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
    // Thin column is a full-height hit target (radius 0); the 8px track keeps the 2px stadium.
    expect(rule(src, '\\.pr-gutter__util--thin')).toMatch(/border-radius:\s*0/);
    expect(rule(src, '\\.pr-gutter__util--thin\\s+\\.pr-gutter__util-track')).toMatch(
      /border-radius:\s*2px/,
    );
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

  it('PR-GUTTER-007: both metrics use fixed 50% midline (shared event-coverage bars)', () => {
    const wrapper = mount(LaneGutter, {
      props: {
        groups: [
          {
            id: 'p1',
            name: 'Process 1',
            utilMidlinePercent: 50,
            lanes: [
              {
                id: 'l1',
                name: 'Thread A',
                color: '#f00',
                bar: { barWidth: 40, label: '1 502', thresholdColor: true },
              },
            ],
          },
        ],
      },
    });
    const mid = wrapper.get('.pr-gutter__util-mid');
    expect(mid.attributes('style')).toContain('left: 50%');
  });

  it('PR-GUTTER-006: thresholdColor drives red/gray fill for both metrics', () => {
    const wrapper = mount(LaneGutter, {
      props: {
        groups: [
          {
            id: 'p1',
            name: 'Process 1',
            lanes: [
              { id: 'low', name: 'Low', color: '#f00', bar: { barWidth: 40, label: '40%', thresholdColor: true } },
              { id: 'mid', name: 'Mid', color: '#0f0', bar: { barWidth: 50, label: '50%', thresholdColor: true } },
              { id: 'high', name: 'High', color: '#00f', bar: { barWidth: 80, label: '1 200', thresholdColor: true } },
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
    await wrapper.setProps({ hoveredLaneId: 'compute' });
    expect(wrapper.get('[data-testid="gutter-folder-compute"]').classes()).toContain(
      'pr-gutter__lane--lane-hover',
    );
    wrapper.unmount();
  });

  it('PR-GUTTER-015: gutter pointerenter/leave emits lane-hover for leaf and folder', async () => {
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
    const wrapper = mount(LaneGutter, { props: { groups: nested } });

    await wrapper.get('[data-testid="gutter-lane-leaf"]').trigger('pointerenter');
    expect(wrapper.emitted('lane-hover')?.at(-1)).toEqual(['leaf']);
    await wrapper.get('[data-testid="gutter-lane-leaf"]').trigger('pointerleave');
    expect(wrapper.emitted('lane-hover')?.at(-1)).toEqual([null]);

    await wrapper.get('[data-testid="gutter-folder-compute"]').trigger('pointerenter');
    expect(wrapper.emitted('lane-hover')?.at(-1)).toEqual(['compute']);
    await wrapper.get('[data-testid="gutter-folder-compute"]').trigger('pointerleave');
    expect(wrapper.emitted('lane-hover')?.at(-1)).toEqual([null]);
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
    expect(document.body.querySelector('.pr-gutter__pin-tip')).toBeNull();
    await pin.trigger('pointerenter');
    expect(document.body.querySelector('.pr-gutter__pin-tip')?.textContent).toBe('Pin to top');

    await wrapper.setProps({ locale: 'zh-CN' });
    expect(wrapper.get('[data-testid="gutter-lane-l1"] [data-testid="lane-pin"]').attributes('aria-label')).toBe(
      '置顶',
    );
    wrapper.unmount();
    expect(document.body.querySelector('.pr-gutter__pin-tip')).toBeNull();
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

  it('PR-GUTTER-016: thin util column hover shows delayed cursor-follow value tooltip', async () => {
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
    await thickLane.get('[data-testid="lane-util"]').trigger('pointerenter', {
      clientX: 40,
      clientY: 20,
    });
    await vi.advanceTimersByTimeAsync(400);
    expect(document.querySelector('[data-testid="lane-util-tip"]')).toBeNull();

    const thinLane = wrapper.get('[data-testid="gutter-lane-mte1"]');
    const thinBar = thinLane.get('[data-testid="lane-util"]');
    expect(thinBar.classes()).toContain('pr-gutter__util--thin');
    expect(thinLane.find('.pr-gutter__util-pct').exists()).toBe(false);

    // Title / row chrome must not open the value tip.
    await thinLane.trigger('pointerenter', { clientX: 40, clientY: 50 });
    await vi.advanceTimersByTimeAsync(400);
    expect(document.querySelector('[data-testid="lane-util-tip"]')).toBeNull();

    // Full-lane-height hit in the util column (CSS stretch above/below the 8px paint).
    const src = (await import('./LaneGutterNode.vue?raw')).default as string;
    expect(src).toMatch(/\.pr-gutter__util--thin\s*\{[^}]*align-self:\s*stretch/s);
    expect(src).toMatch(/\.pr-gutter__util--thin\s+\.pr-gutter__util-track\s*\{[^}]*height:\s*8px/s);

    await thinBar.trigger('pointerenter', { clientX: 100, clientY: 50 });
    expect(document.querySelector('[data-testid="lane-util-tip"]')).toBeNull();
    await vi.advanceTimersByTimeAsync(399);
    expect(document.querySelector('[data-testid="lane-util-tip"]')).toBeNull();
    await vi.advanceTimersByTimeAsync(1);

    const tip = document.querySelector('[data-testid="lane-util-tip"]') as HTMLElement | null;
    expect(tip).toBeTruthy();
    expect(tip!.textContent).toBe('42');
    expect(tip!.style.left).toBe('112px');
    expect(tip!.style.top).toBe('62px');

    await thinBar.trigger('pointermove', { clientX: 130, clientY: 70 });
    expect(tip!.style.left).toBe('142px');
    expect(tip!.style.top).toBe('82px');

    await thinBar.trigger('pointerleave');
    expect(document.querySelector('[data-testid="lane-util-tip"]')).toBeNull();

    // Keyboard focus also opens the tip after the same delay.
    expect(thinBar.attributes('tabindex')).toBe('0');
    await thinBar.trigger('focusin');
    expect(document.querySelector('[data-testid="lane-util-tip"]')).toBeNull();
    await vi.advanceTimersByTimeAsync(400);
    expect(document.querySelector('[data-testid="lane-util-tip"]')).toBeTruthy();
    await thinBar.trigger('focusout');
    expect(document.querySelector('[data-testid="lane-util-tip"]')).toBeNull();

    wrapper.unmount();
    vi.useRealTimers();
  });

  it('PR-GUTTER-018: multi-row leaf renders one tall title cell', () => {
    const wrapper = mount(LaneGutter, {
      props: {
        groups: [
          {
            id: 'p1',
            name: 'P',
            lanes: [{ id: 'l1', name: 'Thread A', color: '#f00', rowCount: 2 }],
          },
        ],
      },
    });
    const lane = wrapper.get('[data-testid="gutter-lane-l1"]');
    expect(lane.attributes('style')).toContain('height: 44px');
    // One title cell, not one per sub-row.
    expect(wrapper.findAll('[data-testid^="gutter-lane-"]')).toHaveLength(1);
    wrapper.unmount();
  });

  it('PR-GUTTER-017: collapse wrapper animates height + opacity during a tween', () => {
    const wrapper = mount(LaneGutter, {
      props: { groups, collapseAnim: { groupId: 'p1', visible: 0.5, hiddenHeight: 44 } },
    });
    const el = wrapper.get('[data-testid="gutter-collapse-p1"]');
    expect(el.attributes('style')).toContain('height: 22px');
    expect(el.attributes('style')).toContain('opacity: 0.5');
    expect(el.attributes('style')).toContain('overflow: hidden');

    // At rest the wrapper has no inline clip, so the pin tooltip is not clipped.
    const rest = mount(LaneGutter, { props: { groups } });
    expect(rest.get('[data-testid="gutter-collapse-p1"]').attributes('style')).toBeUndefined();
    rest.unmount();
    wrapper.unmount();
  });

  it('PR-GUTTER-020: window Card groups to the viewport plus overscan', () => {
    const many = Array.from({ length: 20 }, (_, i) => ({
      id: `c${i}`,
      name: `Card${i}`,
      lanes: [{ id: `l${i}`, name: `L${i}`, color: '#f00' }],
    }));
    expect(shouldVirtualizeGutter(many.length, 100)).toBe(true);
    expect(shouldVirtualizeGutter(GUTTER_VIRTUALIZE_AFTER_GROUPS, 100)).toBe(false);
    expect(shouldVirtualizeGutter(20, 0)).toBe(false);

    const bands = gutterGroupBands(many, new Set());
    expect(bands).toHaveLength(20);
    expect(bands[0]).toMatchObject({ y: 0, h: 62 });
    const mounted = windowGutterGroups(bands, 0, 100);
    const groups = mounted.filter((m) => m.kind === 'group');
    const spacers = mounted.filter((m) => m.kind === 'spacer');
    expect(groups).toHaveLength(6);
    expect(spacers).toHaveLength(1);
    expect(spacers[0]).toEqual({ kind: 'spacer', h: 14 * 62 });

    const wrapper = mount(LaneGutter, {
      props: { groups: many, viewportHeight: 100, scrollY: 0 },
    });
    expect(wrapper.findAll('[data-testid^="gutter-group-"]')).toHaveLength(6);
    expect(wrapper.findAll('[data-testid="gutter-window-spacer"]')).toHaveLength(1);
    expect(wrapper.get('[data-testid="gutter-window-spacer"]').attributes('style')).toContain(
      'height: 868px',
    );
    wrapper.unmount();

    const full = mount(LaneGutter, { props: { groups: many } });
    expect(full.findAll('[data-testid^="gutter-group-"]')).toHaveLength(20);
    expect(full.findAll('[data-testid="gutter-window-spacer"]')).toHaveLength(0);
    full.unmount();

    const sixteen = many.slice(0, 16);
    const capped = mount(LaneGutter, {
      props: { groups: sixteen, viewportHeight: 100, scrollY: 0 },
    });
    expect(capped.findAll('[data-testid^="gutter-group-"]')).toHaveLength(16);
    expect(capped.findAll('[data-testid="gutter-window-spacer"]')).toHaveLength(0);
    capped.unmount();

    const counterBands = gutterGroupBands(
      [
        {
          id: 'ub',
          name: 'UB',
          lanes: [{ id: 'ctr', name: 'UB', color: '#3D64AD', counter: true }],
        },
      ],
      new Set(),
    );
    expect(counterBands[0]!.h).toBe(LANE_GROUP_HEADER_HEIGHT + COUNTER_LANE_HEIGHT);

    const folded = gutterGroupBands(
      [
        {
          id: 'ub',
          name: 'UB',
          lanes: [
            {
              id: 'folder',
              name: 'memory',
              color: '#3D64AD',
              counterFolder: true,
              children: [{ id: 'leaf', name: 'pct', color: '#3D64AD', counter: true }],
            },
          ],
        },
      ],
      new Set(['folder']),
    );
    expect(folded[0]!.h).toBe(LANE_GROUP_HEADER_HEIGHT + COUNTER_LANE_HEIGHT);
  });

  it('PR-GUTTER-020: a focused Card stays mounted outside the window', async () => {
    const many = Array.from({ length: 20 }, (_, i) => ({
      id: `c${i}`,
      name: `Card${i}`,
      lanes: [{ id: `l${i}`, name: `L${i}`, color: '#f00' }],
    }));
    const wrapper = mount(LaneGutter, {
      props: { groups: many, viewportHeight: 100, scrollY: 0 },
      attachTo: document.body,
    });
    const pin = wrapper.get('[data-testid="gutter-collapse-c0"] [data-testid="lane-pin"]')
      .element as HTMLButtonElement;
    pin.focus();
    await wrapper.setProps({ scrollY: 2000 });
    expect(wrapper.find('[data-testid="gutter-group-c0"]').exists()).toBe(true);
    expect(document.activeElement).toBe(pin);
    wrapper.unmount();
  });

  it('PR-GUTTER-022: collapse tween shrinks the windowed Card band', () => {
    const lanes = Array.from({ length: 30 }, (_, i) => ({
      id: `a${i}`,
      name: `A${i}`,
      color: '#f00',
    }));
    const many = [
      { id: 'c0', name: 'Card0', lanes },
      ...Array.from({ length: 19 }, (_, i) => ({
        id: `c${i + 1}`,
        name: `Card${i + 1}`,
        lanes: [{ id: `l${i}`, name: `L${i}`, color: '#f00' }],
      })),
    ];
    const hiddenHeight = 30 * LANE_HEIGHT;
    const anim = { groupId: 'c0', visible: 0.5, hiddenHeight };
    const rest = gutterGroupBands(many, new Set());
    const tween = gutterGroupBands(many, new Set(), anim);
    expect(rest[0]!.h).toBe(LANE_GROUP_HEADER_HEIGHT + hiddenHeight);
    expect(tween[0]!.h).toBe(LANE_GROUP_HEADER_HEIGHT + hiddenHeight / 2);
    expect(tween[1]!.y).toBe(tween[0]!.h);

    const open = mount(LaneGutter, {
      props: { groups: many, viewportHeight: 400, scrollY: 0, collapseAnim: anim },
    });
    // Card 1 is pulled on screen by the shrink (rest y is past the overscan).
    expect(open.find('[data-testid="gutter-group-c1"]').exists()).toBe(true);
    open.unmount();

    const scrolled = mount(LaneGutter, {
      props: { groups: many, viewportHeight: 400, scrollY: 1000, collapseAnim: anim },
    });
    const top = 1000 - 240;
    let spacerH = 0;
    for (const b of tween) {
      if (b.y + b.h < top) spacerH += b.h;
      else break;
    }
    const restSpacer = windowGutterGroups(rest, 1000, 400).find((m) => m.kind === 'spacer');
    expect(restSpacer).toEqual({ kind: 'spacer', h: rest[0]!.h });
    expect(spacerH).not.toBe(rest[0]!.h);
    expect(scrolled.get('[data-testid="gutter-window-spacer"]').attributes('style')).toContain(
      `height: ${spacerH}px`,
    );
    scrolled.unmount();
  });

  it('PR-GUTTER-019: collapsed counterFolder row is COUNTER_LANE_HEIGHT (26px)', async () => {
    // Regression: folder button ignored rowHeightPx → stayed CSS 22px while canvas
    // folds kept 26px, so Card headers below overlapped.
    const counterGroups = [
      {
        id: 'p-above',
        name: 'Above',
        lanes: [{ id: 'leaf-above', name: 'Leaf', color: '#888' }],
      },
      {
        id: 'p-ub',
        name: 'AIV0_UB_UTILIZATION (memory_utilization)',
        lanes: [
          {
            id: 'counter-ub-memory_utilization',
            name: 'memory_utilization',
            color: '#3D64AD',
            counterFolder: true,
            children: [
              {
                id: 'counter-ub-pct',
                name: 'Utilization (%)',
                color: '#3D64AD',
                counter: true,
                height: 26,
              },
              {
                id: 'counter-ub-kb',
                name: 'Using Bytes (KB)',
                color: '#5A7EC4',
                counter: true,
                height: 26,
              },
            ],
          },
        ],
      },
      {
        id: 'p-l1',
        name: 'AIV0_L1_UTILIZATION (memory_utilization)',
        lanes: [
          {
            id: 'counter-l1-memory_utilization',
            name: 'memory_utilization',
            color: '#3D64AD',
            counterFolder: true,
            children: [
              {
                id: 'counter-l1-pct',
                name: 'Utilization (%)',
                color: '#3D64AD',
                counter: true,
                height: 26,
              },
            ],
          },
        ],
      },
    ];

    const collapsed = mount(LaneGutter, {
      props: {
        groups: counterGroups,
        collapsedIds: [
          'p-above',
          'counter-ub-memory_utilization',
          'counter-l1-memory_utilization',
        ],
      },
    });
    const ubFolder = collapsed.get('[data-testid="gutter-folder-counter-ub-memory_utilization"]');
    expect(ubFolder.attributes('style')).toContain('height: 26px');
    expect(ubFolder.attributes('style')).toContain('min-height: 26px');
    const l1Folder = collapsed.get('[data-testid="gutter-folder-counter-l1-memory_utilization"]');
    expect(l1Folder.attributes('style')).toContain('height: 26px');

    // Mid collapse: row grows 22 → 26, and the child wrap keeps the 4px keep.
    const tween = mount(LaneGutter, {
      props: {
        groups: counterGroups,
        collapseAnim: {
          groupId: 'counter-ub-memory_utilization',
          visible: 0.5,
          hiddenHeight: 48,
        },
      },
    });
    const tweenFolder = tween.get('[data-testid="gutter-folder-counter-ub-memory_utilization"]');
    expect(tweenFolder.attributes('style')).toContain('height: 24px');
    const tweenWrap = tween.get('[data-testid="gutter-collapse-counter-ub-memory_utilization"]');
    expect(tweenWrap.attributes('style')).toContain('height: 26px');
    tween.unmount();

    // Card above collapsed: only spacers + two 26px counter folders remain.
    expect(collapsed.find('[data-testid="gutter-lane-leaf-above"]').exists()).toBe(false);
    expect(collapsed.find('[data-testid="gutter-group-p-above"]').exists()).toBe(true);
    expect(collapsed.find('[data-testid="gutter-group-p-ub"]').exists()).toBe(true);
    expect(collapsed.find('[data-testid="gutter-group-p-l1"]').exists()).toBe(true);
    // Cumulative lane rows below the first spacer: 26 + 26 (no overlap / undercount).
    const folderStyles = collapsed
      .findAll('[data-testid^="gutter-folder-counter-"]')
      .map((n) => n.attributes('style') ?? '');
    expect(folderStyles).toHaveLength(2);
    expect(folderStyles.every((s) => s.includes('height: 26px'))).toBe(true);
    collapsed.unmount();

    const expanded = mount(LaneGutter, {
      props: {
        groups: counterGroups,
        collapsedIds: [],
      },
    });
    const expandedFolder = expanded.get(
      '[data-testid="gutter-folder-counter-ub-memory_utilization"]',
    );
    expect(expandedFolder.attributes('style')).toContain('height: 22px');
    expect(expanded.find('[data-testid="gutter-lane-counter-ub-pct"]').exists()).toBe(true);
    expanded.unmount();
  });
});
