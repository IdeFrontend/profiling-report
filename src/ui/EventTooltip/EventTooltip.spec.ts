import { describe, expect, it } from 'vitest';
import { mount } from '@vue/test-utils';
import { formatTime } from '../../domain/formatTime';
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
        unit: 'ms',
      },
    });

    expect(wrapper.find('[data-testid="event-tooltip"]').exists()).toBe(true);
    expect(wrapper.text()).toContain('test_op');
  });

  it('PR-TOOLTIP-002: renders with different time units', () => {
    const wrapper = mount(EventTooltip, {
      props: {
        event: makeEvent(),
        stylePos: { left: '0px', top: '0px' },
        unit: 'us',
      },
    });

    expect(wrapper.find('[data-testid="event-tooltip"]').exists()).toBe(true);
  });

  it('PR-TOOLTIP-003: start time uses producer ts (matches cursor label)', () => {
    const startTime = 3_354_000;
    const wrapper = mount(EventTooltip, {
      props: {
        event: makeEvent({ startTime, duration: 60_000 }),
        stylePos: { left: '0px', top: '0px' },
        unit: 'us',
      },
    });

    expect(wrapper.text()).toContain(formatTime(startTime, 'us'));
  });
});
