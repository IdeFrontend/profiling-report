import { describe, expect, it } from 'vitest';
import { mount } from '@vue/test-utils';
import EventTooltip from './EventTooltip.vue';
import type { SwimEvent } from '../../domain/types';

const makeEvent = (overrides: Partial<SwimEvent> = {}): SwimEvent => ({
  id: 'evt-1',
  name: 'test_op',
  startTime: 100,
  duration: 100,
  ...overrides,
});

describe('EventTooltip', () => {
  it('PR-TOOLTIP-001: renders event name and times', () => {
    const wrapper = mount(EventTooltip, {
      props: {
        event: makeEvent(),
        stylePos: { left: '10px', top: '20px' },
        timeDisplayMode: 'time' as const,
      },
    });

    expect(wrapper.find('[data-testid="event-tooltip"]').exists()).toBe(true);
    expect(wrapper.text()).toContain('test_op');
  });

  it('PR-TOOLTIP-002: formats start/duration/end with per-value units', () => {
    const wrapper = mount(EventTooltip, {
      props: {
        event: makeEvent({
          startTime: 2_000_000,
          duration: 500,
        }),
        stylePos: { left: '0px', top: '0px' },
        timeDisplayMode: 'time' as const,
        timeOrigin: 0,
      },
    });

    const text = wrapper.text();
    expect(text).toContain('2 ms'); // start → ms (sig digits, trailing zeros stripped)
    expect(text).toContain('500 ns'); // duration → ns (4 sig digits)
    expect(text).toContain('2.001 ms'); // end 2_000_500 → ms
  });

  it('PR-TOOLTIP-002: start/end follow nsPerPx digits; duration stays 4 sig', () => {
    // 0.00312 ms/px → 3 fraction digits in ms.
    const nsPerPx = 0.00312 * 1e6;
    const wrapper = mount(EventTooltip, {
      props: {
        event: makeEvent({
          startTime: 16_961_000,
          duration: 41_000,
        }),
        stylePos: { left: '0px', top: '0px' },
        timeDisplayMode: 'time' as const,
        timeOrigin: 0,
        nsPerPx,
      },
    });
    const text = wrapper.text();
    expect(text).toContain('16.961 ms');
    expect(text).toContain('41 µs'); // duration still 4 sig digits
    expect(text).toContain('17.002 ms'); // end = start + dur
  });

  it('PR-TOOLTIP-003: multi-task summary titles as "N tasks"; single-event keeps the real name', () => {
    const many = mount(EventTooltip, {
      props: {
        event: makeEvent({ name: '', taskCount: 4 }),
        stylePos: { left: '0px', top: '0px' },
        timeDisplayMode: 'time' as const,
      },
    });
    expect(many.text()).toContain('4 tasks');

    const one = mount(EventTooltip, {
      props: {
        event: makeEvent({ name: 'matmul_kernel', taskCount: 1, laneName: 'MTE1' }),
        stylePos: { left: '0px', top: '0px' },
        timeDisplayMode: 'time' as const,
      },
    });
    expect(one.text()).toContain('matmul_kernel');
    expect(one.text()).not.toContain('1 task');
  });

  it('PR-TOOLTIP-004: single-event summary shows the source lane title', () => {
    const wrapper = mount(EventTooltip, {
      props: {
        event: makeEvent({ name: 'busy', taskCount: 1, laneName: 'MTE1' }),
        stylePos: { left: '0px', top: '0px' },
        timeDisplayMode: 'time' as const,
      },
    });
    expect(wrapper.find('[data-testid="event-tooltip-lane"]').text()).toBe('MTE1');
  });
});
