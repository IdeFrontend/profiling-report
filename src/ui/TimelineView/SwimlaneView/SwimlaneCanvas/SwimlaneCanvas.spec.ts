import { afterEach, describe, expect, it, vi } from 'vitest';
import { nextTick } from 'vue';
import { mount } from '@vue/test-utils';
import SwimlaneCanvas from './SwimlaneCanvas.vue';
import { CanvasSwimlaneRenderer } from '../../../../swimlane/CanvasSwimlaneRenderer';
import { HARMONYOS_CANVAS_LABEL_FONT, SYSTEM_CANVAS_LABEL_FONT } from '../../../../ui/fontStack';

describe('SwimlaneCanvas', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });
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

  it('PR-ROOT-007: fontFamily selects canvas label font stack', async () => {
    const setLabelFont = vi.spyOn(CanvasSwimlaneRenderer.prototype, 'setLabelFont');
    const model = { processes: [], minTime: 0, maxTime: 1000 };
    const wrapper = mount(SwimlaneCanvas, {
      props: { ...nullProps, model, fontFamily: 'harmony' },
      attachTo: document.body,
    });
    await nextTick();
    expect(setLabelFont).toHaveBeenCalledWith(HARMONYOS_CANVAS_LABEL_FONT);

    setLabelFont.mockClear();
    await wrapper.setProps({ fontFamily: 'system' });
    await nextTick();
    expect(setLabelFont).toHaveBeenCalledWith(SYSTEM_CANVAS_LABEL_FONT);
    wrapper.unmount();
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
    expect(wrapper.emitted('update:measureRange')).toBeFalsy();

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

  it('PR-CANVAS-009: measure fades persist when range is fully before the view; borders hidden', async () => {
    const wrapper = mount(SwimlaneCanvas, {
      props: {
        ...nullProps,
        view: { startTime: 400, endTime: 600, scrollY: 0 },
        measureMode: true,
        measureRange: { startTime: 0, endTime: 100 },
        timeUnit: 'ms',
      },
      attachTo: document.body,
    });
    const wrap = wrapper.find('[data-testid="swimlane"]').element as HTMLElement;
    Object.defineProperty(wrap, 'clientWidth', { value: 400, configurable: true });
    await wrapper.vm.$nextTick();

    expect(wrapper.find('[data-testid="measure-fade-left"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="measure-fade-right"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="measure-border-left"]').exists()).toBe(false);
    expect(wrapper.find('[data-testid="measure-border-right"]').exists()).toBe(false);
    const leftFade = wrapper.get('[data-testid="measure-fade-left"]');
    expect(leftFade.attributes('style')).toMatch(/width:\s*400px/);
    wrapper.unmount();
  });

  it('PR-CANVAS-009b: measure fades persist when range is fully after the view; borders hidden', async () => {
    const wrapper = mount(SwimlaneCanvas, {
      props: {
        ...nullProps,
        view: { startTime: 0, endTime: 200, scrollY: 0 },
        measureMode: true,
        measureRange: { startTime: 500, endTime: 800 },
        timeUnit: 'ms',
      },
      attachTo: document.body,
    });
    const wrap = wrapper.find('[data-testid="swimlane"]').element as HTMLElement;
    Object.defineProperty(wrap, 'clientWidth', { value: 400, configurable: true });
    await wrapper.vm.$nextTick();

    expect(wrapper.find('[data-testid="measure-fade-left"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="measure-fade-right"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="measure-border-left"]').exists()).toBe(false);
    expect(wrapper.find('[data-testid="measure-border-right"]').exists()).toBe(false);
    const leftFade = wrapper.get('[data-testid="measure-fade-left"]');
    expect(leftFade.attributes('style')).toMatch(/width:\s*0px/);
    wrapper.unmount();
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

  const eventModel = {
    minTime: 0,
    maxTime: 1000,
    processes: [
      {
        id: 'p-1',
        name: 'P',
        threads: [
          {
            id: 't-1',
            name: 'T',
            events: [{ id: 'e1', name: 'busy', startTime: 200, duration: 300 }],
          },
        ],
      },
    ],
  };

  async function mountWithEventModel(extra: Record<string, unknown> = {}) {
    const wrapper = mount(SwimlaneCanvas, {
      props: {
        ...nullProps,
        model: eventModel,
        preferRenderer: 'canvas' as const,
        measureMode: true,
        measureRange: null,
        timeUnit: 'ms',
        ...extra,
      },
      attachTo: document.body,
    });
    const wrap = wrapper.find('[data-testid="swimlane"]').element as HTMLElement;
    Object.defineProperty(wrap, 'clientWidth', { value: 400, configurable: true });
    Object.defineProperty(wrap, 'clientHeight', { value: 120, configurable: true });
    Object.defineProperty(wrap, 'getBoundingClientRect', {
      value: () => ({ left: 0, top: 0, width: 400, height: 120, right: 400, bottom: 120 }),
    });
    const canvas = wrapper.find('[data-testid="swimlane-canvas"]');
    const el = canvas.element as HTMLCanvasElement;
    Object.defineProperty(el, 'getBoundingClientRect', {
      value: () => ({ left: 0, top: 0, width: 400, height: 120, right: 400, bottom: 120 }),
    });
    // Model watch → resize with real dimensions so hitTest/eventScreenRect match.
    await wrapper.setProps({
      model: { ...eventModel },
      hoveredEventId: (extra.hoveredEventId as string | null | undefined) ?? null,
    });
    return { wrapper, canvas };
  }

  it('PR-CANVAS-012: hover event shows gray preview borders without fades', async () => {
    const { wrapper } = await mountWithEventModel({ hoveredEventId: 'e1' });
    expect(wrapper.find('[data-testid="measure-preview-left"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="measure-preview-right"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="measure-fade-left"]').exists()).toBe(false);
    const left = wrapper.get('[data-testid="measure-preview-left"]');
    expect(left.attributes('style')).toMatch(/left:\s*80px/);
    expect(left.classes()).toContain('pr-measure-border--preview');

    await wrapper.setProps({ hoveredEventId: null });
    expect(wrapper.find('[data-testid="measure-preview-left"]').exists()).toBe(false);
    wrapper.unmount();
  });

  it('PR-CANVAS-013: click event snaps measureRange and selects; empty click clears', async () => {
    vi.stubGlobal('matchMedia', () => ({ matches: false }));
    const callbacks: FrameRequestCallback[] = [];
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
      callbacks.push(cb);
      return callbacks.length;
    });
    vi.stubGlobal('cancelAnimationFrame', vi.fn());
    vi.spyOn(performance, 'now').mockReturnValue(0);

    const { wrapper, canvas } = await mountWithEventModel();
    const vm = wrapper.vm as { eventScreenRect: (id: string) => { x: number; y: number; w: number; h: number } | null };
    const rect = vm.eventScreenRect('e1');
    expect(rect).toBeTruthy();
    const x = rect!.x + rect!.w / 2;
    const y = rect!.y + rect!.h / 2;

    callbacks.length = 0;
    await canvas.trigger('pointerdown', { clientX: x, clientY: y, pointerId: 1 });
    expect(wrapper.emitted('update:measureRange')).toBeFalsy();
    await canvas.trigger('pointerup', { clientX: x, clientY: y, pointerId: 1 });

    const selected = wrapper.emitted('select')!.at(-1)![0] as { id: string } | null;
    expect(selected?.id).toBe('e1');
    expect(callbacks.length).toBeGreaterThan(0);
    const snapCb = callbacks[0]!;
    for (let ms = 0; ms <= 180; ms += 45) {
      vi.spyOn(performance, 'now').mockReturnValue(ms);
      snapCb(ms);
    }
    const ranges = wrapper.emitted('update:measureRange')!;
    expect(ranges.at(-1)![0]).toEqual({ startTime: 200, endTime: 500 });

    await wrapper.setProps({ measureRange: { startTime: 200, endTime: 500 } });
    vi.spyOn(performance, 'now').mockReturnValue(0);
    callbacks.length = 0;
    await canvas.trigger('pointerdown', { clientX: 10, clientY: 5, pointerId: 2 });
    await canvas.trigger('pointerup', { clientX: 10, clientY: 5, pointerId: 2 });

    expect(callbacks.length).toBeGreaterThan(0);
    const clearCb = callbacks[0]!;
    for (let ms = 0; ms <= 180; ms += 45) {
      vi.spyOn(performance, 'now').mockReturnValue(ms);
      clearCb(ms);
    }
    const afterEmpty = wrapper.emitted('update:measureRange')!;
    expect(afterEmpty.at(-1)![0]).toBeNull();
    // Empty-space click clears the range and clears the selection.
    expect(wrapper.emitted('select')!.length).toBe(2);
    expect(wrapper.emitted('select')!.at(-1)![0]).toBeNull();
    wrapper.unmount();
  });

  it('PR-CANVAS-014: event click with prior range tweens measureRange', async () => {
    vi.stubGlobal('matchMedia', () => ({ matches: false }));
    const callbacks: FrameRequestCallback[] = [];
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
      callbacks.push(cb);
      return callbacks.length;
    });
    vi.stubGlobal('cancelAnimationFrame', vi.fn());
    vi.spyOn(performance, 'now').mockReturnValue(0);

    const { wrapper, canvas } = await mountWithEventModel({
      measureRange: { startTime: 50, endTime: 100 },
    });
    await wrapper.setProps({ measureRange: { startTime: 50, endTime: 100 } });
    callbacks.length = 0;

    const vm = wrapper.vm as { eventScreenRect: (id: string) => { x: number; y: number; w: number; h: number } | null };
    const rect = vm.eventScreenRect('e1')!;
    const x = rect.x + rect.w / 2;
    const y = rect.y + rect.h / 2;

    await canvas.trigger('pointerdown', { clientX: x, clientY: y, pointerId: 1 });
    await canvas.trigger('pointerup', { clientX: x, clientY: y, pointerId: 1 });

    expect(callbacks.length).toBeGreaterThan(0);
    const animCb = callbacks[0]!;
    for (let ms = 0; ms <= 180; ms += 45) {
      vi.spyOn(performance, 'now').mockReturnValue(ms);
      animCb(ms);
    }

    const emitted = wrapper.emitted('update:measureRange')!;
    expect(emitted.length).toBeGreaterThan(1);
    const mid = emitted[Math.floor(emitted.length / 2)][0] as { startTime: number; endTime: number };
    expect(mid.startTime).toBeGreaterThan(50);
    expect(mid.startTime).toBeLessThan(200);
    expect(emitted.at(-1)![0]).toEqual({ startTime: 200, endTime: 500 });
    const selected = wrapper.emitted('select')!.at(-1)![0] as { id: string } | null;
    expect(selected?.id).toBe('e1');
    const suppress = wrapper.emitted('suppress-measure-dt') ?? [];
    expect(suppress.every((e) => e[0] === false)).toBe(true);
    wrapper.unmount();
  });

  it('PR-CANVAS-015: empty click expands measureRange to view then clears', async () => {
    vi.stubGlobal('matchMedia', () => ({ matches: false }));
    const callbacks: FrameRequestCallback[] = [];
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
      callbacks.push(cb);
      return callbacks.length;
    });
    vi.stubGlobal('cancelAnimationFrame', vi.fn());
    vi.spyOn(performance, 'now').mockReturnValue(0);

    const { wrapper, canvas } = await mountWithEventModel({
      measureRange: { startTime: 200, endTime: 500 },
    });
    await wrapper.setProps({ measureRange: { startTime: 200, endTime: 500 } });
    callbacks.length = 0;

    await canvas.trigger('pointerdown', { clientX: 10, clientY: 5, pointerId: 1 });
    await canvas.trigger('pointerup', { clientX: 10, clientY: 5, pointerId: 1 });

    expect(callbacks.length).toBeGreaterThan(0);
    const animCb = callbacks[0]!;
    for (let ms = 0; ms <= 180; ms += 45) {
      vi.spyOn(performance, 'now').mockReturnValue(ms);
      animCb(ms);
    }

    const emitted = wrapper.emitted('update:measureRange')!;
    expect(emitted.length).toBeGreaterThan(1);
    const mid = emitted[Math.floor(emitted.length / 2)][0] as { startTime: number; endTime: number };
    expect(mid).not.toBeNull();
    expect(mid.startTime).toBeLessThan(200);
    expect(mid.endTime).toBeGreaterThan(500);
    // Penultimate frame is the visible window; last emit clears.
    expect(emitted.at(-2)![0]).toEqual({ startTime: 0, endTime: 1000 });
    expect(emitted.at(-1)![0]).toBeNull();
    // Empty-space click clears the selection.
    expect(wrapper.emitted('select')!.at(-1)![0]).toBeNull();
    expect(wrapper.emitted('suppress-measure-dt')?.some((e) => e[0] === true)).toBe(true);
    expect(wrapper.emitted('suppress-measure-dt')!.at(-1)![0]).toBe(false);
    wrapper.unmount();
  });

  it('PR-CANVAS-016: event click with no prior range shrinks from view', async () => {
    vi.stubGlobal('matchMedia', () => ({ matches: false }));
    const callbacks: FrameRequestCallback[] = [];
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
      callbacks.push(cb);
      return callbacks.length;
    });
    vi.stubGlobal('cancelAnimationFrame', vi.fn());
    vi.spyOn(performance, 'now').mockReturnValue(0);

    const { wrapper, canvas } = await mountWithEventModel({ measureRange: null });
    callbacks.length = 0;

    const vm = wrapper.vm as { eventScreenRect: (id: string) => { x: number; y: number; w: number; h: number } | null };
    const rect = vm.eventScreenRect('e1')!;
    const x = rect.x + rect.w / 2;
    const y = rect.y + rect.h / 2;

    await canvas.trigger('pointerdown', { clientX: x, clientY: y, pointerId: 1 });
    await canvas.trigger('pointerup', { clientX: x, clientY: y, pointerId: 1 });

    expect(callbacks.length).toBeGreaterThan(0);
    const animCb = callbacks[0]!;
    for (let ms = 0; ms <= 180; ms += 45) {
      vi.spyOn(performance, 'now').mockReturnValue(ms);
      animCb(ms);
    }

    const emitted = wrapper.emitted('update:measureRange')!;
    expect(emitted.length).toBeGreaterThan(1);
    expect(emitted[0]![0]).toEqual({ startTime: 0, endTime: 1000 });
    const mid = emitted[Math.floor(emitted.length / 2)][0] as { startTime: number; endTime: number };
    expect(mid.startTime).toBeGreaterThan(0);
    expect(mid.startTime).toBeLessThan(200);
    expect(mid.endTime).toBeLessThan(1000);
    expect(mid.endTime).toBeGreaterThan(500);
    expect(emitted.at(-1)![0]).toEqual({ startTime: 200, endTime: 500 });
    const selected = wrapper.emitted('select')!.at(-1)![0] as { id: string } | null;
    expect(selected?.id).toBe('e1');
    wrapper.unmount();
  });

  it('PR-CANVAS-017: appear/clear suppress Δt; range-to-range does not', async () => {
    vi.stubGlobal('matchMedia', () => ({ matches: false }));
    const callbacks: FrameRequestCallback[] = [];
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
      callbacks.push(cb);
      return callbacks.length;
    });
    vi.stubGlobal('cancelAnimationFrame', vi.fn());
    vi.spyOn(performance, 'now').mockReturnValue(0);

    const { wrapper, canvas } = await mountWithEventModel({ measureRange: null });
    callbacks.length = 0;
    const vm = wrapper.vm as { eventScreenRect: (id: string) => { x: number; y: number; w: number; h: number } | null };
    const rect = vm.eventScreenRect('e1')!;
    const x = rect.x + rect.w / 2;
    const y = rect.y + rect.h / 2;

    await canvas.trigger('pointerdown', { clientX: x, clientY: y, pointerId: 1 });
    await canvas.trigger('pointerup', { clientX: x, clientY: y, pointerId: 1 });
    expect(wrapper.emitted('suppress-measure-dt')?.some((e) => e[0] === true)).toBe(true);
    const appearCb = callbacks[0]!;
    for (let ms = 0; ms <= 180; ms += 45) {
      vi.spyOn(performance, 'now').mockReturnValue(ms);
      appearCb(ms);
    }
    expect(wrapper.emitted('suppress-measure-dt')!.at(-1)![0]).toBe(false);

    await wrapper.setProps({ measureRange: { startTime: 200, endTime: 500 } });
    vi.spyOn(performance, 'now').mockReturnValue(0);
    callbacks.length = 0;
    await canvas.trigger('pointerdown', { clientX: 10, clientY: 5, pointerId: 2 });
    await canvas.trigger('pointerup', { clientX: 10, clientY: 5, pointerId: 2 });
    expect(wrapper.emitted('suppress-measure-dt')?.some((e) => e[0] === true)).toBe(true);
    const clearCb = callbacks[0]!;
    for (let ms = 0; ms <= 180; ms += 45) {
      vi.spyOn(performance, 'now').mockReturnValue(ms);
      clearCb(ms);
    }
    expect(wrapper.emitted('suppress-measure-dt')!.at(-1)![0]).toBe(false);
    wrapper.unmount();
  });

  it('PR-CANVAS-018: near event edge snaps cursor and shows snap stem', async () => {
    const { wrapper, canvas } = await mountWithEventModel({ measureMode: false });
    const vm = wrapper.vm as { eventScreenRect: (id: string) => { x: number; y: number; w: number; h: number } | null };
    const rect = vm.eventScreenRect('e1')!;
    const y = rect.y + rect.h / 2;
    // Just outside the block, still within magnet threshold of the start edge.
    await canvas.trigger('pointermove', {
      clientX: rect.x - 5,
      clientY: y,
      pointerId: 1,
    });
    const last = wrapper.emitted('cursor')!.at(-1)![0] as { time: number; xRatio: number };
    expect(last.time).toBe(200);
    expect(wrapper.find('[data-testid="measure-edge-snap"]').exists()).toBe(true);
    const hover = wrapper.emitted('hover')!.at(-1)![0] as { id: string } | null;
    expect(hover?.id).toBe('e1');

    await canvas.trigger('pointerdown', { clientX: rect.x - 5, clientY: y, pointerId: 1 });
    await canvas.trigger('pointerup', { clientX: rect.x - 5, clientY: y, pointerId: 1 });
    const selected = wrapper.emitted('select')!.at(-1)![0] as { id: string } | null;
    expect(selected?.id).toBe('e1');
    wrapper.unmount();
  });

  it('PR-CANVAS-019: outside magnet threshold uses free timeAtX', async () => {
    const { wrapper, canvas } = await mountWithEventModel({ measureMode: false });
    const vm = wrapper.vm as { eventScreenRect: (id: string) => { x: number; y: number; w: number; h: number } | null };
    const rect = vm.eventScreenRect('e1')!;
    const y = rect.y + rect.h / 2;
    const x = rect.x + rect.w / 2; // mid-block, far from both edges on 400px view
    await canvas.trigger('pointermove', { clientX: x, clientY: y, pointerId: 1 });
    const last = wrapper.emitted('cursor')!.at(-1)![0] as { time: number };
    expect(last.time).toBeCloseTo((x / 400) * 1000, 5);
    expect(wrapper.find('[data-testid="measure-edge-snap"]').exists()).toBe(false);
    wrapper.unmount();
  });

  it('PR-CANVAS-020: freeform create magnetizes moving edge', async () => {
    const { wrapper, canvas } = await mountWithEventModel();
    const vm = wrapper.vm as { eventScreenRect: (id: string) => { x: number; y: number; w: number; h: number } | null };
    const rect = vm.eventScreenRect('e1')!;
    const y = rect.y + rect.h / 2;
    // Start far left (free), drag near event start so moving edge snaps to 200.
    await canvas.trigger('pointerdown', { clientX: 20, clientY: y, pointerId: 1 });
    window.dispatchEvent(new PointerEvent('pointermove', { clientX: 40, clientY: y, buttons: 1 }));
    window.dispatchEvent(
      new PointerEvent('pointermove', { clientX: rect.x + 4, clientY: y, buttons: 1 }),
    );
    const ranges = wrapper.emitted('update:measureRange')!;
    expect(ranges.length).toBeGreaterThan(0);
    const last = ranges.at(-1)![0] as { startTime: number; endTime: number };
    expect(last.startTime === 200 || last.endTime === 200).toBe(true);
    wrapper.unmount();
  });

  it('PR-CANVAS-021: committed range shows exact-match blue edge marks', async () => {
    const { wrapper } = await mountWithEventModel({
      measureRange: { startTime: 200, endTime: 500 },
    });
    const marks = wrapper.findAll('[data-testid="measure-edge-exact"]');
    expect(marks.length).toBeGreaterThanOrEqual(2);
    expect(wrapper.find('[data-testid="measure-border-left"]').exists()).toBe(true);

    const leftBefore = marks[0]!.attributes('style') ?? '';
    await wrapper.setProps({ view: { startTime: 0, endTime: 2000, scrollY: 0 } });
    const marksAfter = wrapper.findAll('[data-testid="measure-edge-exact"]');
    expect(marksAfter.length).toBeGreaterThanOrEqual(2);
    expect(marksAfter[0]!.attributes('style')).not.toBe(leftBefore);
    const src = (await import('./SwimlaneCanvas.vue?raw')).default as string;
    expect(src).toMatch(/\.pr-measure-edge-mark--exact\s*\{[^}]*width:\s*2px/);
    wrapper.unmount();
  });

  it('PR-CANVAS-022: Ctrl+wheel near magnetized edge zooms on edge time', async () => {
    const { wrapper, canvas } = await mountWithEventModel({ measureMode: false });
    const vm = wrapper.vm as { eventScreenRect: (id: string) => { x: number; y: number; w: number; h: number } | null };
    const rect = vm.eventScreenRect('e1')!;
    const y = rect.y + rect.h / 2;
    const pointerX = rect.x - 5;
    await canvas.trigger('wheel', {
      clientX: pointerX,
      clientY: y,
      deltaY: -100,
      ctrlKey: true,
    });
    const zoom = wrapper.emitted('zoom')!.at(-1)!;
    expect(zoom[0]).toBe(1.15);
    expect(zoom[1]).toBe(200);
    // Free time under pointer would differ from the magnet edge.
    expect(zoom[1]).not.toBeCloseTo((pointerX / 400) * 1000, 0);
    wrapper.unmount();
  });

  it('PR-CANVAS-023: Ctrl+wheel on measure border zooms on stuck edge time', async () => {
    const { wrapper } = await mountWithEventModel({
      measureRange: { startTime: 200, endTime: 500 },
    });
    const border = wrapper.get('[data-testid="measure-border-right"]');
    await border.trigger('pointerenter', { clientX: 200, clientY: 10 });
    await border.trigger('wheel', {
      clientX: 205,
      clientY: 10,
      deltaY: -100,
      ctrlKey: true,
    });
    const zoom = wrapper.emitted('zoom')!.at(-1)!;
    expect(zoom[0]).toBe(1.15);
    expect(zoom[1]).toBe(500);
    wrapper.unmount();
  });

  it('PR-CANVAS-024: cursor xRatio and time share one track width', async () => {
    const wrapper = mount(SwimlaneCanvas, {
      props: {
        ...nullProps,
        model: { processes: [], minTime: 0, maxTime: 1000 },
      },
      attachTo: document.body,
    });
    const wrap = wrapper.find('[data-testid="swimlane"]').element as HTMLElement;
    const canvas = wrapper.find('[data-testid="swimlane-canvas"]');
    const el = canvas.element as HTMLCanvasElement;
    const trackW = 200.6;
    Object.defineProperty(wrap, 'clientWidth', { value: trackW, configurable: true });
    Object.defineProperty(wrap, 'getBoundingClientRect', {
      value: () => ({
        left: 0,
        top: 0,
        width: trackW,
        height: 100,
        right: trackW,
        bottom: 100,
      }),
      configurable: true,
    });
    Object.defineProperty(el, 'getBoundingClientRect', {
      value: () => ({
        left: 0,
        top: 0,
        width: trackW,
        height: 100,
        right: trackW,
        bottom: 100,
      }),
      configurable: true,
    });

    const x = 100.3;
    await canvas.trigger('pointermove', { clientX: x, clientY: 10, pointerId: 1 });

    const cursor = wrapper.emitted('cursor')?.at(-1)?.[0] as { time: number; xRatio: number };
    expect(cursor).toBeDefined();
    expect(cursor.xRatio).toBeCloseTo(x / trackW, 5);
    expect(cursor.time).toBeCloseTo((x / trackW) * 1000, 5);
    wrapper.unmount();
  });

  it('PR-CANVAS-025: sizes canvas to wrap width, not the HTML default 300px', async () => {
    const wrapper = mount(SwimlaneCanvas, {
      props: {
        ...nullProps,
        model: { processes: [], minTime: 0, maxTime: 1000 },
      },
      attachTo: document.body,
    });
    const wrap = wrapper.find('[data-testid="swimlane"]').element as HTMLElement;
    Object.defineProperty(wrap, 'clientWidth', { value: 640, configurable: true });
    Object.defineProperty(wrap, 'clientHeight', { value: 240, configurable: true });
    Object.defineProperty(wrap, 'getBoundingClientRect', {
      value: () => ({
        left: 0,
        top: 0,
        width: 640,
        height: 240,
        right: 640,
        bottom: 240,
      }),
      configurable: true,
    });
    await wrapper.setProps({
      model: { processes: [], minTime: 0, maxTime: 1000 },
    });
    const canvas = wrapper.get('[data-testid="swimlane-canvas"]').element as HTMLCanvasElement;
    expect(canvas.style.width).toBe('640px');
    wrapper.unmount();
  });

  it('PR-CANVAS-026: measure overlay geometry depends on resizeTick', async () => {
    const src = (await import('./SwimlaneCanvas.vue?raw')).default as string;
    expect(src).toMatch(/const resizeTick = ref\(0\)/);
    expect(src).toMatch(/resizeTick\.value \+= 1/);
    expect(src).toMatch(/measureFadeGeometry = computed\(\(\) => \{\s*void resizeTick\.value/s);
    expect(src).toMatch(/measureGeometry = computed\(\(\) => \{\s*void resizeTick\.value/s);
    expect(src).toMatch(/measurePreviewGeometry = computed\(\(\) => \{\s*void resizeTick\.value/s);
  });
});
