import { describe, expect, it } from 'vitest';
import { mount } from '@vue/test-utils';
import StatsAside from './StatsAside.vue';

describe('StatsAside', () => {
  it('PR-STATS-001: renders empty state when no report', () => {
    const wrapper = mount(StatsAside, {
      props: {
        report: null,
      },
    });

    expect(wrapper.find('[data-testid="stats-aside"]').exists()).toBe(true);
  });
});
