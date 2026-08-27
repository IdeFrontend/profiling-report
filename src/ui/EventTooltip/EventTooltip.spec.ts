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
    expect(text).toContain('2.000 ms'); // start → ms
    expect(text).toContain('500.0 ns'); // duration → ns (4 sig digits)
    expect(text).toContain('2.001 ms'); // end 2_000_500 → ms
  });
});
