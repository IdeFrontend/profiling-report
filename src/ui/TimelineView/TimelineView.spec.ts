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
        unit: 'ms',
        groups: [],
        collapsedIds: [],
        displaySwim: { minTime: 0, maxTime: 1000, processes: [] },
        cursor: null,
      },
    });

    expect(wrapper.find('[data-testid="time-axis"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="gutter-resize-handle"]').exists()).toBe(true);
  });

  it('PR-TIMELINE-002: measure mode keeps overview and draws axis bars + arrow', () => {
    const view = createViewState({
      minTime: 0,
      maxTime: 1000,
      processes: [],
    });
    view.measureMode = true;
    view.measureRange = { startTime: 200, endTime: 500 };
    const wrapper = mount(TimelineView, {
      props: {
        bounds: { minTime: 0, maxTime: 1000 },
        view,
        unit: 'ms',
        groups: [],
        collapsedIds: [],
        displaySwim: { minTime: 0, maxTime: 1000, processes: [] },
        cursor: null,
      },
    });

    expect(wrapper.find('[data-testid="time-overview"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="measure-axis-bar-left"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="measure-axis-bar-right"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="measure-arrow"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="measure-label"]').text()).toMatch(/ms/);
  });
});
