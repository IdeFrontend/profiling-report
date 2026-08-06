import { describe, expect, it } from 'vitest';
import { mount } from '@vue/test-utils';
import SwimlaneCanvas from './SwimlaneCanvas.vue';

describe('SwimlaneCanvas', () => {
  const nullProps = {
    model: null,
    view: { startTime: 0, endTime: 1000, scrollY: 0 },
    selectedEventId: null,
    hoveredEventId: null,
    searchQuery: '',
  };

  it('PR-CANVAS-001: creates canvas element on mount', () => {
    const wrapper = mount(SwimlaneCanvas, { props: nullProps });
    expect(wrapper.find('canvas').exists()).toBe(true);
  });

  it('PR-CANVAS-002: canvas persists after model change', async () => {
    const wrapper = mount(SwimlaneCanvas, { props: nullProps });
    await wrapper.setProps({
      model: { processes: [], minTime: 0, maxTime: 1000 },
    });
    expect(wrapper.find('canvas').exists()).toBe(true);
  });
});
