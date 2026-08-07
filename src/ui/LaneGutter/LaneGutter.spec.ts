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

  it('PR-GUTTER-002: shows utilization percent inside the util bar', () => {
    const wrapper = mount(LaneGutter, {
      props: { groups },
    });

    const util = wrapper.find('[data-testid="lane-util"]');
    expect(util.exists()).toBe(true);
    expect(util.text()).toContain('75%');
    expect(util.find('.pr-gutter__util-pct').exists()).toBe(true);
  });

  it('PR-GUTTER-003: open-angle group chevron only; leaf lanes have no chevron', async () => {
    const wrapper = mount(LaneGutter, {
      props: { groups, collapsedIds: [] },
    });

    expect(wrapper.text()).not.toMatch(/[▾▸▲▼▶◀]/);
    expect(wrapper.find('.pr-gutter__chevron--down').exists()).toBe(true);
    expect(wrapper.findAll('.pr-gutter__chevron--lane').length).toBe(0);
    expect(wrapper.findAll('.pr-gutter__lane .pr-gutter__chevron').length).toBe(0);

    await wrapper.get('[data-testid="gutter-group-p1"]').trigger('click');
    expect(wrapper.emitted('toggle-group')?.[0]).toEqual(['p1']);
  });

  it('PR-GUTTER-004: collapsed group hides child lanes and shows right chevron', () => {
    const wrapper = mount(LaneGutter, {
      props: { groups, collapsedIds: ['p1'] },
    });

    expect(wrapper.text()).toContain('Process 1');
    expect(wrapper.text()).not.toContain('Thread A');
    expect(wrapper.find('.pr-gutter__chevron--right').exists()).toBe(true);
    expect(wrapper.find('.pr-gutter__chevron--down').exists()).toBe(false);
    expect(wrapper.get('[data-testid="gutter-group-p1"]').attributes('aria-expanded')).toBe(
      'false',
    );
  });
});
