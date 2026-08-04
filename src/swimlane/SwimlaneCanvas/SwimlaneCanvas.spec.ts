import { describe, expect, it } from 'vitest';
import { mount } from '@vue/test-utils';
import SwimlaneCanvas from './SwimlaneCanvas.vue';

describe('SwimlaneCanvas', () => {
  it('PR-CANVAS-001: creates canvas element on mount', () => {
    const wrapper = mount(SwimlaneCanvas, {
      props: {
        model: null,
        view: { startTime: 0, endTime: 1000, scrollY: 0 },
        selectedEventId: null,
        hoveredEventId: null,
        searchQuery: '',
      },
    });

    expect(wrapper.find('canvas').exists()).toBe(true);
  });
});
