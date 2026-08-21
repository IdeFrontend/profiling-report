import { describe, expect, it } from 'vitest';
import { mount } from '@vue/test-utils';
import { createViewState } from '../../domain/viewState';
import TimelineView from './TimelineView.vue';

describe('TimelineView', () => {
  it('PR-TIMELINE-001: renders overview, axis, and body', () => {
    const view = createViewState({
      minTime: 0,
      maxTime: 1000,
      processes: [],
    });
    const wrapper = mount(TimelineView, {
      props: {
        bounds: { minTime: 0, maxTime: 1000 },
        view,
        timeDisplayMode: 'time',
        timeScaleUnit: 'ms',
        groups: [],
        collapsedIds: [],
        displaySwim: { minTime: 0, maxTime: 1000, processes: [] },
        cursor: null,
      },
    });

    expect(wrapper.find('[data-testid="time-axis"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="gutter-resize-handle"]').exists()).toBe(true);
  });
});
