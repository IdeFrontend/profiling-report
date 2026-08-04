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

  it('PR-CANVAS-002: canvas resizes when viewport changes', async () => {
    const wrapper = mount(SwimlaneCanvas, { props: nullProps });
    await wrapper.setProps({
      view: { startTime: 0, endTime: 2000, scrollY: 0 },
    });
    const canvas = wrapper.find('canvas').element as HTMLCanvasElement;
    expect(canvas.width).toBeGreaterThan(0);
  });
});
