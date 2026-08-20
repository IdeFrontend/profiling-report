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

  it('PR-CANVAS-003: in measureMode drag emits measureRange and not pan', async () => {
    const wrapper = mount(SwimlaneCanvas, {
      props: {
        ...nullProps,
        model: { processes: [], minTime: 0, maxTime: 1000 },
        measureMode: true,
        measureRange: null,
        timeUnit: 'ms',
      },
      attachTo: document.body,
    });
    const canvas = wrapper.find('[data-testid="swimlane-canvas"]');
    const el = canvas.element as HTMLCanvasElement;
    Object.defineProperty(el, 'getBoundingClientRect', {
      value: () => ({ left: 0, top: 0, width: 200, height: 100, right: 200, bottom: 100 }),
    });
    const wrap = wrapper.find('[data-testid="swimlane"]').element as HTMLElement;
    Object.defineProperty(wrap, 'clientWidth', { value: 200, configurable: true });
    Object.defineProperty(wrap, 'getBoundingClientRect', {
      value: () => ({ left: 0, top: 0, width: 200, height: 100, right: 200, bottom: 100 }),
    });

    await canvas.trigger('pointerdown', { clientX: 20, clientY: 10, pointerId: 1 });
    window.dispatchEvent(new PointerEvent('pointermove', { clientX: 120, clientY: 10, buttons: 1 }));
    window.dispatchEvent(new PointerEvent('pointerup', { clientX: 120, clientY: 10 }));

    expect(wrapper.emitted('pan')).toBeFalsy();
    const ranges = wrapper.emitted('update:measureRange');
    expect(ranges?.length).toBeGreaterThan(0);
    const last = ranges![ranges!.length - 1][0] as { startTime: number; endTime: number };
    expect(last.endTime).toBeGreaterThan(last.startTime);

    const countAfterUp = ranges!.length;
    window.dispatchEvent(new PointerEvent('pointermove', { clientX: 180, clientY: 10, buttons: 0 }));
    expect(wrapper.emitted('update:measureRange')!.length).toBe(countAfterUp);
    wrapper.unmount();
  });

  it('PR-CANVAS-004: measure overlay shows fade and gray borders when measureRange set', () => {
    const wrapper = mount(SwimlaneCanvas, {
      props: {
        ...nullProps,
        measureMode: true,
        measureRange: { startTime: 200, endTime: 500 },
        timeUnit: 'ms',
      },
    });
    expect(wrapper.find('[data-testid="measure-fade-left"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="measure-fade-right"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="measure-border-left"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="measure-border-right"]').exists()).toBe(true);
  });

  it('PR-CANVAS-007: zero-length measure range renders no overlay', () => {
    const wrapper = mount(SwimlaneCanvas, {
      props: {
        ...nullProps,
        measureMode: true,
        measureRange: { startTime: 300, endTime: 300 },
        timeUnit: 'ms',
      },
    });
    expect(wrapper.find('[data-testid="measure-fade-left"]').exists()).toBe(false);
    expect(wrapper.find('[data-testid="measure-border-left"]').exists()).toBe(false);
  });

  it('PR-CANVAS-008: measure overlay clamps fades; omits borders for clipped edges', async () => {
    const wrapper = mount(SwimlaneCanvas, {
      props: {
        ...nullProps,
        view: { startTime: 200, endTime: 600, scrollY: 0 },
        measureMode: true,
        measureRange: { startTime: 150, endTime: 750 },
        timeUnit: 'ms',
      },
      attachTo: document.body,
    });
    const wrap = wrapper.find('[data-testid="swimlane"]').element as HTMLElement;
    Object.defineProperty(wrap, 'clientWidth', { value: 400, configurable: true });
    await wrapper.setProps({ measureRange: { startTime: 100, endTime: 800 } });

    // Both true edges outside — fades span the view, no fake borders at 0/width.
    expect(wrapper.find('[data-testid="measure-fade-left"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="measure-fade-right"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="measure-border-left"]').exists()).toBe(false);
    expect(wrapper.find('[data-testid="measure-border-right"]').exists()).toBe(false);

    await wrapper.setProps({ measureRange: { startTime: 100, endTime: 500 } });
    expect(wrapper.find('[data-testid="measure-border-left"]').exists()).toBe(false);
    const right = wrapper.get('[data-testid="measure-border-right"]');
    expect(right.attributes('style')).toMatch(/left:\s*300px/);
    wrapper.unmount();
  });

  it('PR-CANVAS-009: measure overlay hides when range is fully outside the view', () => {
    const wrapper = mount(SwimlaneCanvas, {
      props: {
        ...nullProps,
        view: { startTime: 400, endTime: 600, scrollY: 0 },
        measureMode: true,
        measureRange: { startTime: 0, endTime: 100 },
        timeUnit: 'ms',
      },
    });
    expect(wrapper.find('[data-testid="measure-fade-left"]').exists()).toBe(false);
    expect(wrapper.find('[data-testid="measure-border-left"]').exists()).toBe(false);
  });

  it('PR-CANVAS-005: pointerleave during measure does not abort drag', async () => {
    const wrapper = mount(SwimlaneCanvas, {
      props: {
        ...nullProps,
        model: { processes: [], minTime: 0, maxTime: 1000 },
        measureMode: true,
        measureRange: null,
        timeUnit: 'ms',
      },
      attachTo: document.body,
    });
    const canvas = wrapper.find('[data-testid="swimlane-canvas"]');
    const el = canvas.element as HTMLCanvasElement;
    Object.defineProperty(el, 'getBoundingClientRect', {
      value: () => ({ left: 0, top: 0, width: 200, height: 100, right: 200, bottom: 100 }),
    });
    const wrap = wrapper.find('[data-testid="swimlane"]').element as HTMLElement;
    Object.defineProperty(wrap, 'clientWidth', { value: 200, configurable: true });
    Object.defineProperty(wrap, 'getBoundingClientRect', {
      value: () => ({ left: 0, top: 0, width: 200, height: 100, right: 200, bottom: 100 }),
    });

    await canvas.trigger('pointerdown', { clientX: 20, clientY: 10, pointerId: 1 });
    await canvas.trigger('pointerleave', { clientX: 20, clientY: -5, pointerId: 1 });
    window.dispatchEvent(new PointerEvent('pointermove', { clientX: 160, clientY: 10, buttons: 1 }));
    window.dispatchEvent(new PointerEvent('pointerup', { clientX: 160, clientY: 10 }));

    expect(wrapper.emitted('select')).toBeFalsy();
    const ranges = wrapper.emitted('update:measureRange');
    expect(ranges?.length).toBeGreaterThan(1);
    const last = ranges![ranges!.length - 1][0] as { startTime: number; endTime: number };
    expect(last.endTime).toBeGreaterThan(last.startTime);
    wrapper.unmount();
  });

  it('PR-CANVAS-006: clearing measureMode mid-drag does not pan or select', async () => {
    const wrapper = mount(SwimlaneCanvas, {
      props: {
        ...nullProps,
        model: { processes: [], minTime: 0, maxTime: 1000 },
        measureMode: true,
        measureRange: null,
        timeUnit: 'ms',
      },
      attachTo: document.body,
    });
    const canvas = wrapper.find('[data-testid="swimlane-canvas"]');
    const el = canvas.element as HTMLCanvasElement;
    Object.defineProperty(el, 'getBoundingClientRect', {
      value: () => ({ left: 0, top: 0, width: 200, height: 100, right: 200, bottom: 100 }),
    });
    const wrap = wrapper.find('[data-testid="swimlane"]').element as HTMLElement;
    Object.defineProperty(wrap, 'clientWidth', { value: 200, configurable: true });

    await canvas.trigger('pointerdown', { clientX: 20, clientY: 10, pointerId: 1 });
    await canvas.trigger('pointermove', { clientX: 80, clientY: 10, pointerId: 1 });
    await wrapper.setProps({ measureMode: false, measureRange: null });
    await canvas.trigger('pointermove', { clientX: 140, clientY: 10, pointerId: 1 });
    await canvas.trigger('pointerup', { clientX: 22, clientY: 10, pointerId: 1 });

    expect(wrapper.emitted('pan')).toBeFalsy();
    expect(wrapper.emitted('select')).toBeFalsy();
    wrapper.unmount();
  });

  it('PR-CANVAS-010: dragging measure border resizes that edge', async () => {
    const wrapper = mount(SwimlaneCanvas, {
      props: {
        ...nullProps,
        measureMode: true,
        measureRange: { startTime: 200, endTime: 500 },
        timeUnit: 'ms',
      },
      attachTo: document.body,
    });
    const wrap = wrapper.find('[data-testid="swimlane"]').element as HTMLElement;
    Object.defineProperty(wrap, 'clientWidth', { value: 400, configurable: true });
    Object.defineProperty(wrap, 'getBoundingClientRect', {
      value: () => ({ left: 0, top: 0, width: 400, height: 100, right: 400, bottom: 100 }),
    });
    await wrapper.setProps({ measureRange: { startTime: 200, endTime: 500 } });

    const right = wrapper.get('[data-testid="measure-border-right"]');
    await right.trigger('pointerdown', { clientX: 200, clientY: 10, button: 0, pointerId: 1 });
    window.dispatchEvent(new PointerEvent('pointermove', { clientX: 280, clientY: 10, buttons: 1 }));
    window.dispatchEvent(new PointerEvent('pointerup', { clientX: 280, clientY: 10 }));

    const ranges = wrapper.emitted('update:measureRange');
    expect(ranges?.length).toBeGreaterThan(0);
    const last = ranges![ranges!.length - 1][0] as { startTime: number; endTime: number };
    expect(last.startTime).toBe(200);
    expect(last.endTime).toBeGreaterThan(500);
    expect(last.endTime).toBeLessThanOrEqual(1000);

    // Further window moves must not keep resizing after pointerup (e.g. over Card strip).
    const countAfterUp = ranges!.length;
    window.dispatchEvent(new PointerEvent('pointermove', { clientX: 320, clientY: 10, buttons: 0 }));
    expect(wrapper.emitted('update:measureRange')!.length).toBe(countAfterUp);

    const src = (await import('./SwimlaneCanvas.vue?raw')).default as string;
    expect(src).toMatch(/\.pr-measure-border\s*\{[^}]*width:\s*9px/);
    expect(src).toMatch(/\.pr-measure-border\s*\{[^}]*cursor:\s*col-resize/);
    expect(src).toMatch(/\.pr-measure-border:hover::before[\s\S]*?width:\s*2px/);
    wrapper.unmount();
  });

  it('PR-CANVAS-011: hovering measure border sticks cursor to that edge', async () => {
    const wrapper = mount(SwimlaneCanvas, {
      props: {
        ...nullProps,
        measureMode: true,
        measureRange: { startTime: 200, endTime: 500 },
        timeUnit: 'ms',
      },
      attachTo: document.body,
    });
    const wrap = wrapper.find('[data-testid="swimlane"]').element as HTMLElement;
    Object.defineProperty(wrap, 'clientWidth', { value: 400, configurable: true });
    await wrapper.setProps({ measureRange: { startTime: 200, endTime: 500 } });

    const right = wrapper.get('[data-testid="measure-border-right"]');
    await right.trigger('pointerenter', { clientX: 200, clientY: 10 });

    const cursors = wrapper.emitted('cursor');
    expect(cursors?.length).toBeGreaterThan(0);
    const last = cursors![cursors!.length - 1][0] as { time: number; xRatio: number };
    expect(last.time).toBe(500);
    expect(last.xRatio).toBeCloseTo(0.5, 5);
    wrapper.unmount();
  });
});
