import { describe, expect, it } from 'vitest';
import { mount } from '@vue/test-utils';
import LaneGutter from './LaneGutter.vue';

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
    expect(fill.attributes('style')).toContain('background: #5c5c5c');
  });

  it('PR-GUTTER-002b: util <50% fill is red', () => {
    const wrapper = mount(LaneGutter, {
      props: { groups },
    });
    const fills = wrapper.findAll('.pr-gutter__util-fill');
    expect(fills[1]!.attributes('style')).toContain('background: #733234');
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

  it('PR-GUTTER-006: thick folder/depth-0 bars; thin pipe leaf under Core', () => {
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
      'background: #733234',
    );
  });

  it('PR-GUTTER-007: filled util has 50% midline; empty util does not', () => {
    const wrapper = mount(LaneGutter, {
      props: {
        groups: [
          {
            id: 'p1',
            name: 'Process 1',
            lanes: [
              { id: 'a', name: 'A', color: '#f00', utilization: 0.46 },
              { id: 'b', name: 'B', color: '#0f0' },
            ],
          },
        ],
      },
    });
    expect(
      wrapper.get('[data-testid="gutter-lane-a"] [data-testid="lane-util"]').find('.pr-gutter__util-mid')
        .exists(),
    ).toBe(true);
    expect(wrapper.get('[data-testid="gutter-lane-b"] .pr-gutter__util--empty').find('.pr-gutter__util-mid').exists()).toBe(
      false,
    );
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
});
