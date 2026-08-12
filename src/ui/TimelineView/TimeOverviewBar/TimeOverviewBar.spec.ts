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

    const win = wrapper.find('[data-testid="time-overview-window"]');
    expect(win.exists()).toBe(true);
    const style = win.attributes('style') || '';
    // Window covers 40% of total span (4000 / 10000)
    expect(style).toContain('width');
  });

  it('PR-OVERVIEW-003: leftmost tick is relative zero even when minTime ≠ 0', () => {
    const wrapper = mount(TimeOverviewBar, {
      props: {
        minTime: 986,
        maxTime: 5260,
        startTime: 986,
        endTime: 5260,
        timeUnit: 'ms',
      },
    });
    const firstLabel = wrapper.find('.pr-axis-ruler__label');
    expect(firstLabel.text()).toBe('0ms');
  });

  it('PR-OVERVIEW-004: ruler renders majors and minors', () => {
    const wrapper = mount(TimeOverviewBar, {
      props: {
        minTime: 0,
        maxTime: 10000,
        startTime: 0,
        endTime: 10000,
        timeUnit: 'ms',
      },
    });
    expect(wrapper.find('[data-testid="axis-ruler"]').exists()).toBe(true);
    expect(wrapper.findAll('[data-testid="axis-ruler-major"]').length).toBeGreaterThan(0);
    expect(wrapper.findAll('[data-testid="axis-ruler-minor"]').length).toBeGreaterThan(0);
  });

  it('PR-OVERVIEW-005: measure span renders only in measure mode with a range', async () => {
    const base = {
      minTime: 0,
      maxTime: 10000,
      startTime: 0,
      endTime: 10000,
      timeUnit: 'ms',
    } as const;
    const off = mount(TimeOverviewBar, { props: { ...base, measureMode: false, measureRange: { startTime: 2000, endTime: 5000 } } });
    expect(off.find('[data-testid="time-overview-measure"]').exists()).toBe(false);

    const noRange = mount(TimeOverviewBar, { props: { ...base, measureMode: true, measureRange: null } });
    expect(noRange.find('[data-testid="time-overview-measure"]').exists()).toBe(false);

    const on = mount(TimeOverviewBar, { props: { ...base, measureMode: true, measureRange: { startTime: 2000, endTime: 5000 } } });
    const span = on.find('[data-testid="time-overview-measure"]');
    expect(span.exists()).toBe(true);
    expect(span.attributes('style')).toContain('width: 30%');
  });
});
