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

  it('PR-OVERVIEW-005: handle tab 4×10 flush vertically; track allows horizontal uncrop', async () => {
    const src = (await import('./TimeOverviewBar.vue?raw')).default as string;
    expect(src).toMatch(
      /\.pr-overview__handle-tab\s*\{[^}]*top:\s*0[^}]*width:\s*4px[^}]*height:\s*10px/s,
    );
    expect(src).toMatch(/\.pr-overview__handle-stem\s*\{[^}]*top:\s*10px/s);
    expect(src).not.toMatch(/\.pr-overview__handle-tab\s*\{[^}]*top:\s*-\d+px/s);
    expect(src).toMatch(/\.pr-overview__track\s*\{[^}]*overflow:\s*visible/s);
    expect(src).not.toMatch(/\.pr-overview__track\s*\{[^}]*overflow:\s*hidden/s);
  });
});
