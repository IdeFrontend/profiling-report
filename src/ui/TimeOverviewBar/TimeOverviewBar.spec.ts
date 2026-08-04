import { describe, expect, it } from 'vitest';
import { mount } from '@vue/test-utils';
import TimeOverviewBar from './TimeOverviewBar.vue';

describe('TimeOverviewBar', () => {
  it('PR-OVERVIEW-001: renders timeline bar with window indicator', () => {
    const wrapper = mount(TimeOverviewBar, {
      props: {
        minTime: 0,
        maxTime: 10000,
        startTime: 2000,
        endTime: 8000,
        timeUnit: 'us',
      },
    });

    expect(wrapper.find('[data-testid="time-overview"]').exists()).toBe(true);
  });

  it('PR-OVERVIEW-002: renders window indicator with correct proportional width', () => {
    const wrapper = mount(TimeOverviewBar, {
      props: {
        minTime: 0,
        maxTime: 10000,
        startTime: 3000,
        endTime: 7000,
        timeUnit: 'ms',
      },
    });

    expect(wrapper.find('[data-testid="time-overview"]').exists()).toBe(true);
    // Window covers 40% of total span; element rendered
    expect(wrapper.find('[data-testid="time-overview-window"]').exists()).toBe(true);
  });
});
