import { describe, expect, it } from 'vitest';
import { mount } from '@vue/test-utils';
import { createViewState } from '../../../domain/viewState';
import SwimlaneView from './SwimlaneView.vue';

describe('SwimlaneView', () => {
  it('PR-SWIMVIEW-001: renders gutter and canvas', () => {
    const view = createViewState({
      minTime: 0,
      maxTime: 1000,
      processes: [],
    });
    const wrapper = mount(SwimlaneView, {
      props: {
        groups: [],
        collapsedIds: [],
        model: { minTime: 0, maxTime: 1000, processes: [] },
        view,
        selectedEventId: null,
        hoveredEventId: null,
        searchQuery: '',
      },
    });

    expect(wrapper.find('.pr-swim-row--body').exists()).toBe(true);
  });
});
