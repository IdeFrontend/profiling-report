import { describe, expect, it } from 'vitest';
import { mount } from '@vue/test-utils';
import LaneGutter from './LaneGutter.vue';

describe('LaneGutter', () => {
  it('PR-GUTTER-001: renders lane names for each group', () => {
    const wrapper = mount(LaneGutter, {
      props: {
        groups: [
          {
            id: 'p1',
            name: 'Process 1',
            lanes: [{ id: 'l1', name: 'Thread A', color: '#f00' }],
          },
        ],
      },
    });

    expect(wrapper.find('[data-testid="lane-gutter"]').exists()).toBe(true);
    expect(wrapper.text()).toContain('Thread A');
  });

  it('PR-GUTTER-002: shows utilization when provided', () => {
    const wrapper = mount(LaneGutter, {
      props: {
        groups: [
          {
            id: 'p1',
            name: 'P1',
            lanes: [{ id: 'l1', name: 'T1', color: '#f00', utilization: 0.75 }],
          },
        ],
      },
    });

    expect(wrapper.text()).toContain('75');
  });
});
