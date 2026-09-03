import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { nextTick } from 'vue';
import { mount, type VueWrapper } from '@vue/test-utils';
import SwimlaneCanvas from './SwimlaneCanvas.vue';

/** ResizeObservers created during a test — call `fireAllDeviceRo()` after setting wrap client size. */
const roHandles: { fire: () => void }[] = [];

function stubDeviceResizeObserver(): void {
  roHandles.length = 0;
  vi.stubGlobal(
    'ResizeObserver',
    class {
      private el: Element | null = null;
      constructor(private cb: ResizeObserverCallback) {
        roHandles.push(this);
      }
      observe(el: Element) {
        this.el = el;
        this.fire();
      }
      fire() {
        if (!this.el) return;
        const wrap = this.el.closest('[data-testid="swimlane"]') as HTMLElement | null;
        const w = wrap?.clientWidth ?? 0;
        const h = wrap?.clientHeight ?? 0;
        if (w <= 0 || h <= 0) return;
        const dpr = typeof window !== 'undefined' && window.devicePixelRatio > 0 ? window.devicePixelRatio : 1;
        this.cb(
          [
            {
              target: this.el,
              devicePixelContentBoxSize: [{ inlineSize: Math.round(w * dpr), blockSize: Math.round(h * dpr) }],
              contentBoxSize: [{ inlineSize: w, blockSize: h }],
              borderBoxSize: [],
              contentRect: this.el.getBoundingClientRect(),
            } as unknown as ResizeObserverEntry,
          ],
          this as unknown as ResizeObserver,
        );
      }
      disconnect() {}
      unobserve() {}
    },
  );
}

async function fireAllDeviceRo(): Promise<void> {
  await nextTick();
  for (const ro of roHandles) ro.fire();
  await nextTick();
}

describe('SwimlaneCanvas', () => {
  beforeEach(() => {
    stubDeviceResizeObserver();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });
  const nullProps = {
    model: null,
    view: { startTime: 0, endTime: 1000, scrollY: 0 },
    selectedEventId: null,
    hoveredEventId: null,
    searchQuery: ''
  };

  it('PR-CANVAS-001: creates canvas element on mount', () => {
    const wrapper = mount(SwimlaneCanvas, { props: nullProps });
    expect(wrapper.find('canvas').exists()).toBe(true);
  });

  it('PR-CANVAS-044: mounts only the active renderer canvases', async () => {
    const canvasOnly = mount(SwimlaneCanvas, {
      props: { ...nullProps, preferRenderer: 'canvas' as const },
    });
    await nextTick();
    expect(canvasOnly.findAll('canvas')).toHaveLength(1);
    expect(canvasOnly.find('[data-testid="swimlane-canvas"]').exists()).toBe(true);
    expect(canvasOnly.find('[data-testid="swimlane-webgl"]').exists()).toBe(false);
    canvasOnly.unmount();

    const auto = mount(SwimlaneCanvas, { props: nullProps });
    await nextTick();
    const canvases = auto.findAll('canvas');
    const webgl = auto.find('[data-testid="swimlane-webgl"]');
    if (webgl.exists()) {
      expect(canvases).toHaveLength(2);
      expect(auto.find('[data-testid="swimlane-canvas"]').exists()).toBe(true);
    } else {
      expect(canvases).toHaveLength(1);
      expect(auto.find('[data-testid="swimlane-canvas"]').exists()).toBe(true);
    }
    auto.unmount();
  });

  it('PR-CANVAS-002: canvas persists after model change', async () => {
    const wrapper = mount(SwimlaneCanvas, { props: nullProps });
    await wrapper.setProps({
      model: { processes: [], minTime: 0, maxTime: 1000 }
    });
    expect(wrapper.find('canvas').exists()).toBe(true);
  });

  it('PR-CANVAS-003: in measureMode drag emits measureRange and not pan', async () => {
    const wrapper = mount(SwimlaneCanvas, {
      props: {
        ...nullProps,
        model: { processes: [], minTime: 0, maxTime: 1000 },
        measureMode: true,
        measureRange: null
      },
      attachTo: document.body
    });
    const canvas = wrapper.find('[data-testid="swimlane-canvas"]');
    const el = canvas.element as HTMLCanvasElement;
    Object.defineProperty(el, 'getBoundingClientRect', {
      value: () => ({ left: 0, top: 0, width: 200, height: 100, right: 200, bottom: 100 })
    });
    const wrap = wrapper.find('[data-testid="swimlane"]').element as HTMLElement;
    Object.defineProperty(wrap, 'clientWidth', { value: 200, configurable: true });
    Object.defineProperty(wrap, 'getBoundingClientRect', {
      value: () => ({ left: 0, top: 0, width: 200, height: 100, right: 200, bottom: 100 })
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
        measureRange: { startTime: 200, endTime: 500 }
      }
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
        measureRange: { startTime: 300, endTime: 300 }
      }
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
        measureRange: { startTime: 150, endTime: 750 }
      },
      attachTo: document.body
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
        measureRange: { startTime: 0, endTime: 100 }
      },
      attachTo: document.body
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
        measureRange: { startTime: 500, endTime: 800 }
      },
      attachTo: document.body
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
        measureRange: null
      },
      attachTo: document.body
    });
    const canvas = wrapper.find('[data-testid="swimlane-canvas"]');
    const el = canvas.element as HTMLCanvasElement;
    Object.defineProperty(el, 'getBoundingClientRect', {
      value: () => ({ left: 0, top: 0, width: 200, height: 100, right: 200, bottom: 100 })
    });
    const wrap = wrapper.find('[data-testid="swimlane"]').element as HTMLElement;
    Object.defineProperty(wrap, 'clientWidth', { value: 200, configurable: true });
    Object.defineProperty(wrap, 'getBoundingClientRect', {
      value: () => ({ left: 0, top: 0, width: 200, height: 100, right: 200, bottom: 100 })
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
        measureRange: null
      },
      attachTo: document.body
    });
    const canvas = wrapper.find('[data-testid="swimlane-canvas"]');
    const el = canvas.element as HTMLCanvasElement;
    Object.defineProperty(el, 'getBoundingClientRect', {
      value: () => ({ left: 0, top: 0, width: 200, height: 100, right: 200, bottom: 100 })
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
        measureRange: { startTime: 200, endTime: 500 }
      },
      attachTo: document.body
    });
    const wrap = wrapper.find('[data-testid="swimlane"]').element as HTMLElement;
    Object.defineProperty(wrap, 'clientWidth', { value: 400, configurable: true });
    Object.defineProperty(wrap, 'getBoundingClientRect', {
      value: () => ({ left: 0, top: 0, width: 400, height: 100, right: 400, bottom: 100 })
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
        measureRange: { startTime: 200, endTime: 500 }
      },
      attachTo: document.body
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
            events: [{ id: 'e1', name: 'busy', startTime: 200, duration: 300 }]
          },
        ]
      },
    ]
  };

  async function mountWithEventModel(extra: Record<string, unknown> = {}) {
    const wrapper = mount(SwimlaneCanvas, {
      props: {
        ...nullProps,
        model: eventModel,
        preferRenderer: 'canvas' as const,
        measureMode: true,
        measureRange: null,

        ...extra
      },
      attachTo: document.body
    });
    const wrap = wrapper.find('[data-testid="swimlane"]').element as HTMLElement;
    Object.defineProperty(wrap, 'clientWidth', { value: 400, configurable: true });
    Object.defineProperty(wrap, 'clientHeight', { value: 120, configurable: true });
    Object.defineProperty(wrap, 'getBoundingClientRect', {
      value: () => ({ left: 0, top: 0, width: 400, height: 120, right: 400, bottom: 120 })
    });
    const canvas = wrapper.find('[data-testid="swimlane-canvas"]');
    const el = canvas.element as HTMLCanvasElement;
    Object.defineProperty(el, 'getBoundingClientRect', {
      value: () => ({ left: 0, top: 0, width: 400, height: 120, right: 400, bottom: 120 })
    });
    // Model watch → resize with real dimensions so hitTest/eventScreenRect match.
    await wrapper.setProps({
      model: { ...eventModel },
      hoveredEventId: (extra.hoveredEventId as string | null | undefined) ?? null
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
      measureRange: { startTime: 50, endTime: 100 }
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
      measureRange: { startTime: 200, endTime: 500 }
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
      pointerId: 1
    });
    const last = wrapper.emitted('cursor')!.at(-1)![0] as { time: number; xRatio: number; snapped?: boolean };
    expect(last.time).toBe(200);
    expect(last.snapped).toBe(true);
    expect(wrapper.find('[data-testid="measure-edge-snap"]').exists()).toBe(true);
    const hover = wrapper.emitted('hover')!.at(-1)![0] as { id: string } | null;
    expect(hover?.id).toBe('e1');

    const src = (await import('./SwimlaneCanvas.vue?raw')).default as string;
    expect(src).toMatch(/\.pr-measure-edge-mark--snap\s*\{[^}]*width:\s*2px/);

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
    const last = wrapper.emitted('cursor')!.at(-1)![0] as { time: number; snapped?: boolean };
    expect(last.time).toBeCloseTo((x / 400) * 1000, 5);
    expect(last.snapped).toBe(false);
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
      measureRange: { startTime: 200, endTime: 500 }
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
      ctrlKey: true
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
      measureRange: { startTime: 200, endTime: 500 }
    });
    const border = wrapper.get('[data-testid="measure-border-right"]');
    await border.trigger('pointerenter', { clientX: 200, clientY: 10 });
    await border.trigger('wheel', {
      clientX: 205,
      clientY: 10,
      deltaY: -100,
      ctrlKey: true
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
        model: { processes: [], minTime: 0, maxTime: 1000 }
      },
      attachTo: document.body
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
        bottom: 100
      }),
      configurable: true
    });
    Object.defineProperty(el, 'getBoundingClientRect', {
      value: () => ({
        left: 0,
        top: 0,
        width: trackW,
        height: 100,
        right: trackW,
        bottom: 100
      }),
      configurable: true
    });

    const x = 100.3;
    await canvas.trigger('pointermove', { clientX: x, clientY: 10, pointerId: 1 });

    const cursor = wrapper.emitted('cursor')?.at(-1)?.[0] as { time: number; xRatio: number };
    expect(cursor).toBeDefined();
    expect(cursor.xRatio).toBeCloseTo(x / trackW, 5);
    expect(cursor.time).toBeCloseTo((x / trackW) * 1000, 5);
    wrapper.unmount();
  });

  it('PR-CANVAS-025: sizes canvas backing store from RO device box; no style sizing; stays 0 until RO', async () => {
    const wrapper = mount(SwimlaneCanvas, {
      props: {
        ...nullProps,
        model: { processes: [], minTime: 0, maxTime: 1000 }
      },
      attachTo: document.body
    });
    const canvas = wrapper.get('[data-testid="swimlane-canvas"]').element as HTMLCanvasElement;
    expect(canvas.width).toBe(0);
    expect(canvas.height).toBe(0);

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
        bottom: 240
      }),
      configurable: true
    });
    await fireAllDeviceRo();
    expect(canvas.width).toBe(640);
    expect(canvas.height).toBe(240);
    expect(canvas.style.width).toBe('');
    expect(canvas.style.height).toBe('');
    wrapper.unmount();
  });

  it('PR-CANVAS-026: measure overlay geometry depends on resizeTick', async () => {
    const src = (await import('./SwimlaneCanvas.vue?raw')).default as string;
    expect(src).toMatch(/const resizeTick = ref\(0\)/);
    expect(src).toMatch(/resizeTick\.value \+= 1/);
    expect(src).toMatch(/measureFadeGeometry = computed\(\(\) => \{\s*void resizeTick\.value/s);
    expect(src).toMatch(/measureGeometry = computed\(\(\) => \{\s*void resizeTick\.value/s);
    expect(src).toMatch(/measurePreviewGeometry = computed\(\(\) => \{\s*void resizeTick\.value/s);
    expect(src).toMatch(/gapMeasureGeometry = computed\(\(\) => \{\s*void resizeTick\.value/s);
  });

  const gapModel = {
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
            events: [
              { id: 'eA', name: 'a', startTime: 100, duration: 100 }, // 100..200 → px 40..80
              { id: 'eB', name: 'b', startTime: 500, duration: 100 }, // 500..600 → px 200..240
            ]
          },
        ]
      },
    ]
  };

  async function mountWithGapModel(extra: Record<string, unknown> = {}) {
    const effectiveModel = (extra.model ?? gapModel) as typeof gapModel;
    const wrapper = mount(SwimlaneCanvas, {
      props: {
        ...nullProps,
        model: effectiveModel,
        preferRenderer: 'canvas' as const,
        measureMode: false,
        measureRange: null,

        ...extra
      },
      attachTo: document.body
    });
    const wrap = wrapper.find('[data-testid="swimlane"]').element as HTMLElement;
    Object.defineProperty(wrap, 'clientWidth', { value: 400, configurable: true });
    Object.defineProperty(wrap, 'clientHeight', { value: 120, configurable: true });
    Object.defineProperty(wrap, 'getBoundingClientRect', {
      value: () => ({ left: 0, top: 0, width: 400, height: 120, right: 400, bottom: 120 })
    });
    const canvas = wrapper.find('[data-testid="swimlane-canvas"]');
    const el = canvas.element as HTMLCanvasElement;
    Object.defineProperty(el, 'getBoundingClientRect', {
      value: () => ({ left: 0, top: 0, width: 400, height: 120, right: 400, bottom: 120 })
    });
    await wrapper.setProps({ model: { ...effectiveModel } });
    return { wrapper, canvas };
  }

  async function gapLaneY(wrapper: VueWrapper) {
    const vm = wrapper.vm as unknown as {
      eventScreenRect: (id: string) => { x: number; y: number; w: number; h: number } | null;
    };
    const rect = vm.eventScreenRect('eA')!;
    return rect.y + rect.h / 2;
  }

  it('PR-CANVAS-027: default-mode hover in a gap renders sticks + arrow + Δt label', async () => {
    const { wrapper, canvas } = await mountWithGapModel();
    const y = await gapLaneY(wrapper);
    // Gap 200..500 → px 80..200; free middle at x=140 (far from both edges).
    await canvas.trigger('pointermove', { clientX: 140, clientY: y, pointerId: 1 });

    expect(wrapper.find('[data-testid="gap-measure"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="gap-measure-stick-left"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="gap-measure-stick-right"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="measure-arrow"]').exists()).toBe(true);
    expect(wrapper.get('[data-testid="measure-arrow"]').classes()).not.toContain('pr-measure-arrow--interactive');
    expect(wrapper.get('[data-testid="measure-label"]').text()).toBe('300 ns');
    const leftStick = wrapper.get('[data-testid="gap-measure-stick-left"]');
    expect(leftStick.attributes('style')).toMatch(/left:\s*80px/);
    wrapper.unmount();
  });

  it('PR-CANVAS-028: hovering an event block renders no gap overlay', async () => {
    const { wrapper, canvas } = await mountWithGapModel();
    const y = await gapLaneY(wrapper);
    // eA spans px 40..80; x=60 is over the block.
    await canvas.trigger('pointermove', { clientX: 60, clientY: y, pointerId: 1 });

    expect(wrapper.find('[data-testid="gap-measure"]').exists()).toBe(false);
    wrapper.unmount();
  });

  it('PR-CANVAS-029: hovering within magnet threshold of an edge renders no gap overlay', async () => {
    const { wrapper, canvas } = await mountWithGapModel();
    const y = await gapLaneY(wrapper);
    // x=85 is 5px from eA end (80px) — magnet/tooltip wins over the gap.
    await canvas.trigger('pointermove', { clientX: 85, clientY: y, pointerId: 1 });

    expect(wrapper.find('[data-testid="gap-measure"]').exists()).toBe(false);
    wrapper.unmount();
  });

  it('PR-CANVAS-030: measureMode suppresses the hover gap overlay', async () => {
    const { wrapper, canvas } = await mountWithGapModel({ measureMode: true });
    const y = await gapLaneY(wrapper);
    await canvas.trigger('pointermove', { clientX: 140, clientY: y, pointerId: 1 });

    expect(wrapper.find('[data-testid="gap-measure"]').exists()).toBe(false);
    wrapper.unmount();
  });

  it('PR-CANVAS-031: pan drag keeps the hover gap overlay and refreshes on view change', async () => {
    const { wrapper, canvas } = await mountWithGapModel();
    const y = await gapLaneY(wrapper);
    await canvas.trigger('pointermove', { clientX: 140, clientY: y, pointerId: 1 });
    expect(wrapper.find('[data-testid="gap-measure"]').exists()).toBe(true);

    await canvas.trigger('pointerdown', { clientX: 140, clientY: y, pointerId: 1 });
    await canvas.trigger('pointermove', { clientX: 150, clientY: y, pointerId: 1 });
    expect(wrapper.find('[data-testid="gap-measure"]').exists()).toBe(true);

    // Parent applies pan delta — overlay recomputes at last pointer.
    await wrapper.setProps({
      view: { startTime: 25, endTime: 1025, scrollY: 0 }
    });
    expect(wrapper.find('[data-testid="gap-measure"]').exists()).toBe(true);
    await canvas.trigger('pointerup', { clientX: 150, clientY: y, pointerId: 1 });
    wrapper.unmount();
  });

  it('PR-CANVAS-032: pointerleave clears the hover gap overlay', async () => {
    const { wrapper, canvas } = await mountWithGapModel();
    const y = await gapLaneY(wrapper);
    await canvas.trigger('pointermove', { clientX: 140, clientY: y, pointerId: 1 });
    expect(wrapper.find('[data-testid="gap-measure"]').exists()).toBe(true);

    await canvas.trigger('pointerleave', { clientX: 140, clientY: y, pointerId: 1 });
    expect(wrapper.find('[data-testid="gap-measure"]').exists()).toBe(false);
    wrapper.unmount();
  });

  it('PR-CANVAS-033: hover gap overlay survives hoveredEventId-only view updates', async () => {
    const { wrapper, canvas } = await mountWithGapModel();
    const y = await gapLaneY(wrapper);
    await canvas.trigger('pointermove', { clientX: 140, clientY: y, pointerId: 1 });
    expect(wrapper.find('[data-testid="gap-measure"]').exists()).toBe(true);

    // Parent hover emit replaces view object without changing the time window.
    await wrapper.setProps({
      hoveredEventId: 'some-other-id',
      view: { startTime: 0, endTime: 1000, scrollY: 0 }
    });
    expect(wrapper.find('[data-testid="gap-measure"]').exists()).toBe(true);
    wrapper.unmount();
  });

  it('PR-CANVAS-034: no gap overlay when Δt label does not fit inside the gap span', async () => {
    const narrowGapModel = {
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
              events: [
                { id: 'eA', name: 'a', startTime: 100, duration: 100 }, // ends 200
                { id: 'eB', name: 'b', startTime: 205, duration: 100 }, // 5-unit gap
              ]
            },
          ]
        },
      ]
    };
    const wrapper = mount(SwimlaneCanvas, {
      props: {
        ...nullProps,
        model: narrowGapModel,
        preferRenderer: 'canvas' as const,
        measureMode: false,
        measureRange: null
      },
      attachTo: document.body
    });
    const wrap = wrapper.find('[data-testid="swimlane"]').element as HTMLElement;
    Object.defineProperty(wrap, 'clientWidth', { value: 400, configurable: true });
    Object.defineProperty(wrap, 'clientHeight', { value: 120, configurable: true });
    const canvas = wrapper.find('[data-testid="swimlane-canvas"]');
    const el = canvas.element as HTMLCanvasElement;
    Object.defineProperty(el, 'getBoundingClientRect', {
      value: () => ({ left: 0, top: 0, width: 400, height: 120, right: 400, bottom: 120 })
    });
    await wrapper.setProps({ model: { ...narrowGapModel } });
    const vm = wrapper.vm as unknown as {
      eventScreenRect: (id: string) => { x: number; y: number; w: number; h: number } | null;
    };
    const rect = vm.eventScreenRect('eA')!;
    const y = rect.y + rect.h / 2;
    // Gap mid ≈ px 82 — ~2px span; label "5 ns" cannot fit inline.
    await canvas.trigger('pointermove', { clientX: 82, clientY: y, pointerId: 1 });
    expect(wrapper.find('[data-testid="gap-measure"]').exists()).toBe(false);
    wrapper.unmount();
  });

  it('PR-CANVAS-035: zoom view update refreshes hover gap at last pointer', async () => {
    const { wrapper, canvas } = await mountWithGapModel();
    const y = await gapLaneY(wrapper);
    await canvas.trigger('pointermove', { clientX: 140, clientY: y, pointerId: 1 });
    expect(wrapper.find('[data-testid="gap-measure"]').exists()).toBe(true);

    // Simulate cmd+wheel zoom: narrower window still containing the gap at x=140.
    await wrapper.setProps({
      view: { startTime: 180, endTime: 520, scrollY: 0 }
    });
    expect(wrapper.find('[data-testid="gap-measure"]').exists()).toBe(true);

    // Zoom until both gap edges fall outside the view but the gap still spans it.
    await wrapper.setProps({
      view: { startTime: 250, endTime: 260, scrollY: 0 }
    });
    expect(wrapper.find('[data-testid="gap-measure"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="gap-measure-stick-left"]').exists()).toBe(false);
    expect(wrapper.find('[data-testid="gap-measure-stick-right"]').exists()).toBe(false);
    wrapper.unmount();
  });

  it('PR-CANVAS-036: hover gap hides when the entire gap is outside the view', async () => {
    const { wrapper, canvas } = await mountWithGapModel();
    const y = await gapLaneY(wrapper);
    await canvas.trigger('pointermove', { clientX: 140, clientY: y, pointerId: 1 });
    expect(wrapper.find('[data-testid="gap-measure"]').exists()).toBe(true);

    // Gap 200..500 is entirely before the view.
    await wrapper.setProps({
      view: { startTime: 600, endTime: 900, scrollY: 0 }
    });
    expect(wrapper.find('[data-testid="gap-measure"]').exists()).toBe(false);
    wrapper.unmount();
  });

  const dualLaneGapModel = {
    minTime: 0,
    maxTime: 1000,
    processes: [
      {
        id: 'p-1',
        name: 'P',
        threads: [
          {
            id: 't-1',
            name: 'T1',
            events: [
              { id: 'eA1', name: 'a', startTime: 100, duration: 100 },
              { id: 'eB1', name: 'b', startTime: 500, duration: 100 },
            ]
          },
          {
            id: 't-2',
            name: 'T2',
            events: [
              { id: 'eA2', name: 'c', startTime: 100, duration: 100 },
              { id: 'eB2', name: 'd', startTime: 500, duration: 100 },
            ]
          },
        ]
      },
    ]
  };

  async function mountWithDualLaneGapModel() {
    const wrapper = mount(SwimlaneCanvas, {
      props: {
        ...nullProps,
        model: dualLaneGapModel,
        preferRenderer: 'canvas' as const,
        measureMode: false,
        measureRange: null
      },
      attachTo: document.body
    });
    const wrap = wrapper.find('[data-testid="swimlane"]').element as HTMLElement;
    Object.defineProperty(wrap, 'clientWidth', { value: 400, configurable: true });
    Object.defineProperty(wrap, 'clientHeight', { value: 240, configurable: true });
    Object.defineProperty(wrap, 'getBoundingClientRect', {
      value: () => ({ left: 0, top: 0, width: 400, height: 240, right: 400, bottom: 240 })
    });
    const canvas = wrapper.find('[data-testid="swimlane-canvas"]');
    const el = canvas.element as HTMLCanvasElement;
    Object.defineProperty(el, 'getBoundingClientRect', {
      value: () => ({ left: 0, top: 0, width: 400, height: 240, right: 400, bottom: 240 })
    });
    await wrapper.setProps({ model: { ...dualLaneGapModel } });
    return { wrapper, canvas };
  }

  it('PR-CANVAS-037: pan drag freezes hover gap on the original lane', async () => {
    const { wrapper, canvas } = await mountWithDualLaneGapModel();
    const vm = wrapper.vm as unknown as {
      eventScreenRect: (id: string) => { x: number; y: number; w: number; h: number } | null;
    };
    const lane1Y = vm.eventScreenRect('eA1')!.y + vm.eventScreenRect('eA1')!.h / 2;
    const lane2Y = vm.eventScreenRect('eA2')!.y + vm.eventScreenRect('eA2')!.h / 2;

    await canvas.trigger('pointermove', { clientX: 140, clientY: lane1Y, pointerId: 1 });
    expect(wrapper.find('[data-testid="gap-measure"]').exists()).toBe(true);
    const topBefore = wrapper.get('[data-testid="gap-measure"]').attributes('style');

    await canvas.trigger('pointerdown', { clientX: 140, clientY: lane1Y, pointerId: 1 });
    await canvas.trigger('pointermove', { clientX: 150, clientY: lane2Y, pointerId: 1 });
    expect(wrapper.find('[data-testid="gap-measure"]').exists()).toBe(true);
    expect(wrapper.get('[data-testid="gap-measure"]').attributes('style')).toBe(topBefore);

    await canvas.trigger('pointerup', { clientX: 150, clientY: lane2Y, pointerId: 1 });
    wrapper.unmount();
  });

  it('PR-CANVAS-038: pan drag freezes event hover until pointerup', async () => {
    const wrapper = mount(SwimlaneCanvas, {
      props: {
        ...nullProps,
        model: eventModel,
        preferRenderer: 'canvas' as const,
        measureMode: false,
        measureRange: null
      },
      attachTo: document.body
    });
    const wrap = wrapper.find('[data-testid="swimlane"]').element as HTMLElement;
    Object.defineProperty(wrap, 'clientWidth', { value: 400, configurable: true });
    Object.defineProperty(wrap, 'clientHeight', { value: 120, configurable: true });
    const canvas = wrapper.find('[data-testid="swimlane-canvas"]');
    const el = canvas.element as HTMLCanvasElement;
    Object.defineProperty(el, 'getBoundingClientRect', {
      value: () => ({ left: 0, top: 0, width: 400, height: 120, right: 400, bottom: 120 })
    });
    await wrapper.setProps({ model: { ...eventModel }, measureMode: false });

    const vm = wrapper.vm as unknown as {
      eventScreenRect: (id: string) => { x: number; y: number; w: number; h: number } | null;
    };
    const rect = vm.eventScreenRect('e1')!;
    const x = rect.x + rect.w / 2;
    const y = rect.y + rect.h / 2;

    await canvas.trigger('pointermove', { clientX: x, clientY: y, pointerId: 1 });
    expect((wrapper.emitted('hover')!.at(-1)![0] as { id: string } | null)?.id).toBe('e1');

    await canvas.trigger('pointerdown', { clientX: x, clientY: y, pointerId: 1 });
    await canvas.trigger('pointermove', { clientX: 10, clientY: 5, pointerId: 1 });
    expect((wrapper.emitted('hover')!.at(-1)![0] as { id: string } | null)?.id).toBe('e1');

    await canvas.trigger('pointerup', { clientX: 10, clientY: 5, pointerId: 1 });
    expect(wrapper.emitted('hover')!.at(-1)![0]).toBeNull();
    wrapper.unmount();
  });

  it('PR-CANVAS-039: freeform create keeps the anchor border marker during drag', async () => {
    const { wrapper, canvas } = await mountWithEventModel();
    const vm = wrapper.vm as { eventScreenRect: (id: string) => { x: number; y: number; w: number; h: number } | null };
    const rect = vm.eventScreenRect('e1')!;
    const y = rect.y + rect.h / 2;
    // Press on the event start edge → the anchor magnetizes to 200.
    await canvas.trigger('pointerdown', { clientX: rect.x, clientY: y, pointerId: 1 });
    // Drag right past the threshold; the moving edge is free (inside the block).
    window.dispatchEvent(
      new PointerEvent('pointermove', { clientX: rect.x + 60, clientY: y, buttons: 1 }),
    );
    // Reflect the in-flight range as the parent would, driving the measureRange watcher.
    await wrapper.setProps({ measureRange: { startTime: 200, endTime: 350 } });

    // The anchor (start) border marker must stay visible while the drag is active.
    const marks = wrapper.findAll('[data-testid="measure-edge-exact"]');
    expect(marks.length).toBeGreaterThan(0);

    window.dispatchEvent(new PointerEvent('pointerup', { clientX: rect.x + 60, clientY: y }));
    wrapper.unmount();
  });

  it('PR-CANVAS-040: blue edge marks stack above the swim playhead stem', async () => {
    const src = (await import('./SwimlaneCanvas.vue?raw')).default as string;
    expect(src).toMatch(/\.pr-swim-cursor\s*\{[^}]*z-index:\s*9/);
    expect(src).toMatch(/\.pr-measure-edge-mark\s*\{[^}]*z-index:\s*10/);
    expect(src).toMatch(/\.pr-measure-edge-mark--snap\s*\{[^}]*z-index:\s*11/);
  });

  it('PR-CANVAS-041: resize drag off an event emits unsnapped cursor', async () => {
    const { wrapper } = await mountWithEventModel({
      measureRange: { startTime: 200, endTime: 500 }
    });
    const right = wrapper.get('[data-testid="measure-border-right"]');
    await right.trigger('pointerdown', { clientX: 200, clientY: 60, pointerId: 1, button: 0 });
    window.dispatchEvent(
      new PointerEvent('pointermove', { clientX: 320, clientY: 60, buttons: 1 }),
    );

    const last = wrapper.emitted('cursor')!.at(-1)![0] as { snapped?: boolean };
    expect(last.snapped).toBe(false);
    expect(right.classes()).toContain('pr-measure-border--dragging');

    const src = (await import('./SwimlaneCanvas.vue?raw')).default as string;
    expect(src).toMatch(/\.pr-measure-border--dragging::before\s*\{[^}]*display:\s*none/);

    window.dispatchEvent(new PointerEvent('pointerup', { clientX: 320, clientY: 60 }));
    wrapper.unmount();
  });

  it('PR-CANVAS-042: repeated snap at the same time scans exact edges once', async () => {
    const layout = await import('../../../../swimlane/layout');
    const spy = vi.spyOn(layout, 'findExactEdgeMatchesAt');
    const { wrapper, canvas } = await mountWithEventModel({ measureMode: false });
    const vm = wrapper.vm as { eventScreenRect: (id: string) => { x: number; y: number; w: number; h: number } | null };
    const rect = vm.eventScreenRect('e1')!;
    const y = rect.y + rect.h / 2;
    spy.mockClear();

    for (let i = 0; i < 5; i++) {
      await canvas.trigger('pointermove', { clientX: rect.x - 5, clientY: y, pointerId: 1 });
    }

    expect(spy.mock.calls.length).toBe(1);
    expect(wrapper.find('[data-testid="measure-edge-snap"]').exists()).toBe(true);
    spy.mockRestore();
    wrapper.unmount();
  });

  it('PR-CANVAS-043: measure border hover emits snapped on event edges', async () => {
    const { wrapper } = await mountWithEventModel({
      measureRange: { startTime: 200, endTime: 500 }
    });
    const left = wrapper.get('[data-testid="measure-border-left"]');
    await left.trigger('pointerenter', { clientX: 80, clientY: 60 });

    const last = wrapper.emitted('cursor')!.at(-1)![0] as { time: number; snapped?: boolean };
    expect(last.time).toBe(200);
    expect(last.snapped).toBe(true);
    wrapper.unmount();
  });

  it('PR-CANVAS-045: Alt+click anchor + Alt+hover target shows event measure without selecting', async () => {
    const { wrapper, canvas } = await mountWithGapModel();
    const y = await gapLaneY(wrapper);
    await canvas.trigger('pointerdown', { clientX: 60, clientY: y, pointerId: 1, altKey: true });
    await canvas.trigger('pointerup', { clientX: 60, clientY: y, pointerId: 1, altKey: true });

    expect(wrapper.emitted('select')).toBeFalsy();
    expect(wrapper.find('[data-testid="alt-measure-anchor"]').exists()).toBe(true);

    await canvas.trigger('pointermove', { clientX: 220, clientY: y, pointerId: 1, altKey: true });
    expect(wrapper.find('[data-testid="alt-event-measure"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="measure-label"]').text()).toBe('300 ns');

    window.dispatchEvent(new KeyboardEvent('keyup', { key: 'Alt', code: 'AltLeft' }));
    await nextTick();
    expect(wrapper.find('[data-testid="alt-event-measure"]').exists()).toBe(false);
    expect(wrapper.find('[data-testid="alt-measure-anchor"]').exists()).toBe(false);
    wrapper.unmount();
  });

  it('PR-CANVAS-046: Alt measure hidden when anchor and target overlap in time', async () => {
    const overlapModel = {
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
              events: [
                { id: 'eA', name: 'a', startTime: 100, duration: 200 },
                { id: 'eB', name: 'b', startTime: 150, duration: 50 },
              ],
            },
          ],
        },
      ],
    };
    const { wrapper, canvas } = await mountWithGapModel({ model: overlapModel });
    const y = await gapLaneY(wrapper);
    await canvas.trigger('pointerdown', { clientX: 60, clientY: y, pointerId: 1, altKey: true });
    await canvas.trigger('pointerup', { clientX: 60, clientY: y, pointerId: 1, altKey: true });
    await canvas.trigger('pointermove', { clientX: 70, clientY: y, pointerId: 1, altKey: true });

    expect(wrapper.find('[data-testid="alt-measure-anchor"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="alt-event-measure"]').exists()).toBe(false);
    wrapper.unmount();
  });

  it('PR-CANVAS-049: touching events (Δt = 0) render no event-measure overlay', async () => {
    const touchingModel = {
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
              events: [
                { id: 'eA', name: 'a', startTime: 100, duration: 100 }, // 100..200 → px 40..80
                { id: 'eB', name: 'b', startTime: 200, duration: 100 }, // 200..300 → px 80..120
              ],
            },
          ],
        },
      ],
    };
    const { wrapper, canvas } = await mountWithGapModel({ model: touchingModel });
    const y = await gapLaneY(wrapper);
    await canvas.trigger('pointerdown', { clientX: 60, clientY: y, pointerId: 1, altKey: true });
    await canvas.trigger('pointerup', { clientX: 60, clientY: y, pointerId: 1, altKey: true });
    await canvas.trigger('pointermove', { clientX: 100, clientY: y, pointerId: 1, altKey: true });

    expect(wrapper.find('[data-testid="alt-measure-anchor"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="alt-event-measure"]').exists()).toBe(false);
    expect(wrapper.find('[data-testid="alt-measure-target"]').exists()).toBe(false);

    // Alt+click touching target must not pin.
    await canvas.trigger('pointerdown', { clientX: 100, clientY: y, pointerId: 1, altKey: true });
    await canvas.trigger('pointerup', { clientX: 100, clientY: y, pointerId: 1, altKey: true });
    window.dispatchEvent(new KeyboardEvent('keyup', { key: 'Alt', code: 'AltLeft' }));
    await nextTick();
    expect(wrapper.find('[data-testid="alt-measure-anchor"]').exists()).toBe(false);
    expect(wrapper.find('[data-testid="alt-event-measure"]').exists()).toBe(false);
    wrapper.unmount();
  });

  it('PR-CANVAS-054: anchor highlight follows the anchored event across view changes', async () => {
    const { wrapper, canvas } = await mountWithGapModel();
    const y = await gapLaneY(wrapper);
    await canvas.trigger('pointerdown', { clientX: 60, clientY: y, pointerId: 1, altKey: true });
    await canvas.trigger('pointerup', { clientX: 60, clientY: y, pointerId: 1, altKey: true });

    const anchor = () => wrapper.find('[data-testid="alt-measure-anchor"]');
    expect(anchor().exists()).toBe(true);
    const leftPx = (el: ReturnType<typeof anchor>) =>
      Number(/left:\s*(-?[\d.]+)px/.exec(el.attributes('style') ?? '')?.[1] ?? NaN);
    const before = leftPx(anchor());

    // Shift the view window right so the anchored event (100..200) moves left on screen.
    await wrapper.setProps({ view: { startTime: 50, endTime: 1050, scrollY: 0 } });
    expect(anchor().exists()).toBe(true);
    const after = leftPx(anchor());

    expect(after).toBeLessThan(before);
    wrapper.unmount();
  });

  it('PR-CANVAS-055: hovering a target event highlights it as the captured target', async () => {
    const { wrapper, canvas } = await mountWithGapModel();
    const y = await gapLaneY(wrapper);
    await canvas.trigger('pointerdown', { clientX: 60, clientY: y, pointerId: 1, altKey: true });
    await canvas.trigger('pointerup', { clientX: 60, clientY: y, pointerId: 1, altKey: true });
    await canvas.trigger('pointermove', { clientX: 220, clientY: y, pointerId: 1, altKey: true });

    expect(wrapper.find('[data-testid="alt-measure-anchor"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="alt-measure-target"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="alt-event-measure"]').exists()).toBe(true);
    // Alt retargeting must not clear event hover (tooltip / hoveredEventId).
    const hoverEmits = wrapper.emitted('hover') ?? [];
    const lastHover = hoverEmits[hoverEmits.length - 1]?.[0] as { id?: string } | null;
    expect(lastHover?.id).toBe('eB');
    wrapper.unmount();
  });

  it('PR-CANVAS-056: sticking to a target border measures to that explicit edge', async () => {
    const { wrapper, canvas } = await mountWithGapModel();
    const y = await gapLaneY(wrapper);
    await canvas.trigger('pointerdown', { clientX: 60, clientY: y, pointerId: 1, altKey: true });
    await canvas.trigger('pointerup', { clientX: 60, clientY: y, pointerId: 1, altKey: true });
    // eB = 500..600 → px 200..240; hover near its end edge (240) to capture the end, not the auto start.
    await canvas.trigger('pointermove', { clientX: 239, clientY: y, pointerId: 1, altKey: true });

    expect(wrapper.find('[data-testid="alt-event-measure"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="measure-label"]').text()).toBe('400 ns');
    wrapper.unmount();
  });

  it('PR-CANVAS-057: free cursor target renders a full-height blue line', async () => {
    const { wrapper, canvas } = await mountWithGapModel();
    const y = await gapLaneY(wrapper);
    await canvas.trigger('pointerdown', { clientX: 60, clientY: y, pointerId: 1, altKey: true });
    await canvas.trigger('pointerup', { clientX: 60, clientY: y, pointerId: 1, altKey: true });
    // Empty space after eB (px 240) → free cursor at time 750 (px 300).
    await canvas.trigger('pointermove', { clientX: 300, clientY: y, pointerId: 1, altKey: true });

    expect(wrapper.find('[data-testid="alt-event-measure"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="alt-measure-cursor-line"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="measure-label"]').text()).toBe('550 ns');
    wrapper.unmount();
  });

  it('PR-CANVAS-047: hovering the anchor event shows only the anchor highlight', async () => {
    const { wrapper, canvas } = await mountWithGapModel();
    const y = await gapLaneY(wrapper);
    await canvas.trigger('pointerdown', { clientX: 60, clientY: y, pointerId: 1, altKey: true });
    await canvas.trigger('pointerup', { clientX: 60, clientY: y, pointerId: 1, altKey: true });
    await canvas.trigger('pointermove', { clientX: 60, clientY: y, pointerId: 1, altKey: true });

    expect(wrapper.find('[data-testid="alt-measure-anchor"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="alt-measure-target"]').exists()).toBe(false);
    expect(wrapper.find('[data-testid="alt-event-measure"]').exists()).toBe(false);
    wrapper.unmount();
  });

  it('PR-CANVAS-048: Δt is directional — measures to the earlier target\'s end edge', async () => {
    const { wrapper, canvas } = await mountWithGapModel();
    const y = await gapLaneY(wrapper);
    // Anchor eB (500..600); hover eA (100..200), which precedes → target = eA.end (200).
    await canvas.trigger('pointerdown', { clientX: 220, clientY: y, pointerId: 1, altKey: true });
    await canvas.trigger('pointerup', { clientX: 220, clientY: y, pointerId: 1, altKey: true });
    await canvas.trigger('pointermove', { clientX: 60, clientY: y, pointerId: 1, altKey: true });

    expect(wrapper.find('[data-testid="alt-event-measure"]').exists()).toBe(true);
    // 500 − 200 = 300 (using the earlier event's end; its start would give 400).
    expect(wrapper.find('[data-testid="measure-label"]').text()).toBe('300 ns');
    wrapper.unmount();
  });

  it('PR-CANVAS-050: cross-lane measure draws the dashed connector and Δt label', async () => {
    const src = (await import('./SwimlaneCanvas.vue?raw')).default as string;
    // Same stack as the swim cursor — above Card strips — so the dashed vertical
    // stays unbroken through Card headers (AC-13 failure mode for Alt-measure).
    expect(src).toMatch(/\.pr-alt-measure\s*\{[^}]*z-index:\s*9/);

    const crossModel = {
      minTime: 0,
      maxTime: 1000,
      processes: [
        {
          id: 'p-1',
          name: 'P',
          threads: [
            { id: 't-1', name: 'Lane A', events: [{ id: 'eA', name: 'a', startTime: 100, duration: 100 }] },
            { id: 't-2', name: 'Lane B', events: [{ id: 'eB', name: 'b', startTime: 400, duration: 100 }] },
          ],
        },
      ],
    };
    const { wrapper, canvas } = await mountWithGapModel({ model: crossModel });
    const vm = wrapper.vm as unknown as {
      eventScreenRect: (id: string) => { x: number; y: number; w: number; h: number } | null;
    };
    const rectA = vm.eventScreenRect('eA')!;
    const rectB = vm.eventScreenRect('eB')!;
    const yA = rectA.y + rectA.h / 2;
    const yB = rectB.y + rectB.h / 2;
    await canvas.trigger('pointerdown', { clientX: 60, clientY: yA, pointerId: 1, altKey: true });
    await canvas.trigger('pointerup', { clientX: 60, clientY: yA, pointerId: 1, altKey: true });
    await canvas.trigger('pointermove', { clientX: 180, clientY: yB, pointerId: 1, altKey: true });

    expect(wrapper.find('[data-testid="alt-event-measure"]').exists()).toBe(true);
    expect(wrapper.find('.pr-alt-measure__vertical').exists()).toBe(true);
    expect(wrapper.find('[data-testid="measure-label"]').text()).toBe('200 ns');
    wrapper.unmount();
  });

  it('PR-CANVAS-051: ephemeral clears on Escape / pointermove without Alt; same-anchor Alt+click is a no-op', async () => {
    const { wrapper, canvas } = await mountWithGapModel();
    const y = await gapLaneY(wrapper);
    await canvas.trigger('pointerdown', { clientX: 60, clientY: y, pointerId: 1, altKey: true });
    await canvas.trigger('pointerup', { clientX: 60, clientY: y, pointerId: 1, altKey: true });
    expect(wrapper.find('[data-testid="alt-measure-anchor"]').exists()).toBe(true);

    // Same anchor again while ephemeral → no-op (still anchored).
    await canvas.trigger('pointerdown', { clientX: 60, clientY: y, pointerId: 1, altKey: true });
    await canvas.trigger('pointerup', { clientX: 60, clientY: y, pointerId: 1, altKey: true });
    expect(wrapper.find('[data-testid="alt-measure-anchor"]').exists()).toBe(true);

    // Missed Alt keyup (e.g. Alt+Tab): next pointermove with altKey false clears ephemeral.
    await canvas.trigger('pointermove', { clientX: 140, clientY: y, pointerId: 1, altKey: false });
    await nextTick();
    expect(wrapper.find('[data-testid="alt-measure-anchor"]').exists()).toBe(false);

    await canvas.trigger('pointerdown', { clientX: 60, clientY: y, pointerId: 1, altKey: true });
    await canvas.trigger('pointerup', { clientX: 60, clientY: y, pointerId: 1, altKey: true });
    expect(wrapper.find('[data-testid="alt-measure-anchor"]').exists()).toBe(true);

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    await nextTick();
    expect(wrapper.find('[data-testid="alt-measure-anchor"]').exists()).toBe(false);
    wrapper.unmount();
  });

  it('PR-CANVAS-052: entering measureMode clears the session', async () => {
    const { wrapper, canvas } = await mountWithGapModel();
    const y = await gapLaneY(wrapper);
    await canvas.trigger('pointerdown', { clientX: 60, clientY: y, pointerId: 1, altKey: true });
    await canvas.trigger('pointerup', { clientX: 60, clientY: y, pointerId: 1, altKey: true });
    expect(wrapper.find('[data-testid="alt-measure-anchor"]').exists()).toBe(true);

    await wrapper.setProps({ measureMode: true });
    expect(wrapper.find('[data-testid="alt-measure-anchor"]').exists()).toBe(false);
    wrapper.unmount();
  });

  it('PR-CANVAS-053: hover gap measure is suppressed while an Alt session is active', async () => {
    const { wrapper, canvas } = await mountWithGapModel();
    const y = await gapLaneY(wrapper);
    await canvas.trigger('pointerdown', { clientX: 60, clientY: y, pointerId: 1, altKey: true });
    await canvas.trigger('pointerup', { clientX: 60, clientY: y, pointerId: 1, altKey: true });
    // Free middle of the gap (px 140) with Alt held → alt cursor overlay, not the hover gap.
    await canvas.trigger('pointermove', { clientX: 140, clientY: y, pointerId: 1, altKey: true });

    expect(wrapper.find('[data-testid="gap-measure"]').exists()).toBe(false);
    expect(wrapper.find('[data-testid="alt-event-measure"]').exists()).toBe(true);

    // Pan capture while Alt session active must not freeze/show a hover gap.
    await canvas.trigger('pointerdown', { clientX: 140, clientY: y, pointerId: 2, altKey: true });
    await canvas.trigger('pointermove', {
      clientX: 160,
      clientY: y,
      pointerId: 2,
      buttons: 1,
      altKey: true,
    });
    expect(wrapper.find('[data-testid="gap-measure"]').exists()).toBe(false);
    await canvas.trigger('pointerup', { clientX: 160, clientY: y, pointerId: 2, altKey: true });
    wrapper.unmount();
  });

  it('PR-CANVAS-058: anchor highlight uses CSS px (not device px) on hi-dpi', async () => {
    Object.defineProperty(window, 'devicePixelRatio', { value: 2, configurable: true });
    const { wrapper, canvas } = await mountWithGapModel();
    await fireAllDeviceRo();
    const vm = wrapper.vm as unknown as {
      eventScreenRect: (id: string) => { x: number; y: number; w: number; h: number } | null;
    };
    const dev = vm.eventScreenRect('eA')!;
    const y = (dev.y + dev.h / 2) / 2; // device → CSS midpoint
    await canvas.trigger('pointerdown', { clientX: 60, clientY: y, pointerId: 1, altKey: true });
    await canvas.trigger('pointerup', { clientX: 60, clientY: y, pointerId: 1, altKey: true });

    const anchor = wrapper.find('[data-testid="alt-measure-anchor"]');
    expect(anchor.exists()).toBe(true);
    const style = anchor.attributes('style') ?? '';
    const left = Number(/left:\s*(-?[\d.]+)px/.exec(style)?.[1] ?? NaN);
    const width = Number(/width:\s*(-?[\d.]+)px/.exec(style)?.[1] ?? NaN);
    // eA = 100..200 in a 0..1000 view at 400 CSS px → x=40, w=40 (device px would be 80).
    expect(left).toBe(40);
    expect(width).toBe(40);
    wrapper.unmount();
    Object.defineProperty(window, 'devicePixelRatio', { value: 1, configurable: true });
  });

  it('PR-CANVAS-059: narrow cross-lane gap (< 8px) still shows Alt-measure + Δt', async () => {
    // 10 ns gap at 400 CSS px / 1000 ns → 4px visible span (under the old rangePx < 8 hide gate).
    const narrowCrossModel = {
      minTime: 0,
      maxTime: 1000,
      processes: [
        {
          id: 'p-1',
          name: 'P',
          threads: [
            { id: 't-1', name: 'Lane A', events: [{ id: 'eA', name: 'a', startTime: 100, duration: 100 }] },
            { id: 't-2', name: 'Lane B', events: [{ id: 'eB', name: 'b', startTime: 210, duration: 100 }] },
          ],
        },
      ],
    };
    const { wrapper, canvas } = await mountWithGapModel({ model: narrowCrossModel });
    const vm = wrapper.vm as unknown as {
      eventScreenRect: (id: string) => { x: number; y: number; w: number; h: number } | null;
    };
    const rectA = vm.eventScreenRect('eA')!;
    const rectB = vm.eventScreenRect('eB')!;
    const yA = rectA.y + rectA.h / 2;
    const yB = rectB.y + rectB.h / 2;
    await canvas.trigger('pointerdown', { clientX: 60, clientY: yA, pointerId: 1, altKey: true });
    await canvas.trigger('pointerup', { clientX: 60, clientY: yA, pointerId: 1, altKey: true });
    // eB = 210..310 → px 84..124; hover mid-block.
    await canvas.trigger('pointermove', { clientX: 100, clientY: yB, pointerId: 1, altKey: true });

    expect(wrapper.find('[data-testid="alt-event-measure"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="measure-label"]').text()).toBe('10 ns');
    wrapper.unmount();
  });

  it('PR-CANVAS-060: Alt+click target pins; Alt keyup keeps the overlay', async () => {
    const { wrapper, canvas } = await mountWithGapModel();
    const y = await gapLaneY(wrapper);
    await canvas.trigger('pointerdown', { clientX: 60, clientY: y, pointerId: 1, altKey: true });
    await canvas.trigger('pointerup', { clientX: 60, clientY: y, pointerId: 1, altKey: true });
    // Pin by Alt+clicking eB (500..600 → px 200..240).
    await canvas.trigger('pointerdown', { clientX: 220, clientY: y, pointerId: 1, altKey: true });
    await canvas.trigger('pointerup', { clientX: 220, clientY: y, pointerId: 1, altKey: true });

    expect(wrapper.find('[data-testid="alt-event-measure"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="measure-label"]').text()).toBe('300 ns');

    window.dispatchEvent(new KeyboardEvent('keyup', { key: 'Alt', code: 'AltLeft' }));
    await nextTick();
    expect(wrapper.find('[data-testid="alt-event-measure"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="alt-measure-anchor"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="alt-measure-target"]').exists()).toBe(true);
    wrapper.unmount();
  });

  it('PR-CANVAS-061: pinned highlights use pink for both (no blue --target)', async () => {
    const { wrapper, canvas } = await mountWithGapModel();
    const y = await gapLaneY(wrapper);
    await canvas.trigger('pointerdown', { clientX: 60, clientY: y, pointerId: 1, altKey: true });
    await canvas.trigger('pointerup', { clientX: 60, clientY: y, pointerId: 1, altKey: true });
    await canvas.trigger('pointerdown', { clientX: 220, clientY: y, pointerId: 1, altKey: true });
    await canvas.trigger('pointerup', { clientX: 220, clientY: y, pointerId: 1, altKey: true });
    window.dispatchEvent(new KeyboardEvent('keyup', { key: 'Alt', code: 'AltLeft' }));
    await nextTick();

    const target = wrapper.get('[data-testid="alt-measure-target"]');
    expect(target.classes()).toContain('pr-alt-measure-anchor');
    expect(target.classes()).not.toContain('pr-alt-measure-anchor--target');
    wrapper.unmount();
  });

  it('PR-CANVAS-062: pinned Alt+click event re-anchors and drops the pin', async () => {
    const { wrapper, canvas } = await mountWithGapModel();
    const y = await gapLaneY(wrapper);
    await canvas.trigger('pointerdown', { clientX: 60, clientY: y, pointerId: 1, altKey: true });
    await canvas.trigger('pointerup', { clientX: 60, clientY: y, pointerId: 1, altKey: true });
    await canvas.trigger('pointerdown', { clientX: 220, clientY: y, pointerId: 1, altKey: true });
    await canvas.trigger('pointerup', { clientX: 220, clientY: y, pointerId: 1, altKey: true });
    expect(wrapper.find('[data-testid="alt-event-measure"]').exists()).toBe(true);

    // Re-anchor on eB → pin dropped, overlay gone until a new target.
    await canvas.trigger('pointerdown', { clientX: 220, clientY: y, pointerId: 1, altKey: true });
    await canvas.trigger('pointerup', { clientX: 220, clientY: y, pointerId: 1, altKey: true });
    expect(wrapper.find('[data-testid="alt-event-measure"]').exists()).toBe(false);
    expect(wrapper.find('[data-testid="alt-measure-anchor"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="alt-measure-target"]').exists()).toBe(false);
    wrapper.unmount();
  });

  it('PR-CANVAS-063: pinned measure clears on empty click and on view change', async () => {
    const { wrapper, canvas } = await mountWithGapModel();
    const y = await gapLaneY(wrapper);
    await canvas.trigger('pointerdown', { clientX: 60, clientY: y, pointerId: 1, altKey: true });
    await canvas.trigger('pointerup', { clientX: 60, clientY: y, pointerId: 1, altKey: true });
    await canvas.trigger('pointerdown', { clientX: 220, clientY: y, pointerId: 1, altKey: true });
    await canvas.trigger('pointerup', { clientX: 220, clientY: y, pointerId: 1, altKey: true });
    window.dispatchEvent(new KeyboardEvent('keyup', { key: 'Alt', code: 'AltLeft' }));
    await nextTick();
    expect(wrapper.find('[data-testid="alt-event-measure"]').exists()).toBe(true);

    // Empty click clears.
    await canvas.trigger('pointerdown', { clientX: 300, clientY: y, pointerId: 1 });
    await canvas.trigger('pointerup', { clientX: 300, clientY: y, pointerId: 1 });
    expect(wrapper.find('[data-testid="alt-event-measure"]').exists()).toBe(false);

    // Pin again, then pan the view → clears.
    await canvas.trigger('pointerdown', { clientX: 60, clientY: y, pointerId: 1, altKey: true });
    await canvas.trigger('pointerup', { clientX: 60, clientY: y, pointerId: 1, altKey: true });
    await canvas.trigger('pointerdown', { clientX: 220, clientY: y, pointerId: 1, altKey: true });
    await canvas.trigger('pointerup', { clientX: 220, clientY: y, pointerId: 1, altKey: true });
    window.dispatchEvent(new KeyboardEvent('keyup', { key: 'Alt', code: 'AltLeft' }));
    await nextTick();
    expect(wrapper.find('[data-testid="alt-event-measure"]').exists()).toBe(true);

    await wrapper.setProps({ view: { startTime: 50, endTime: 1050, scrollY: 0 } });
    expect(wrapper.find('[data-testid="alt-event-measure"]').exists()).toBe(false);
    expect(wrapper.find('[data-testid="alt-measure-anchor"]').exists()).toBe(false);
    wrapper.unmount();
  });

  it('PR-CANVAS-064: default swim canvas cursor is arrow; events pointer; measure col-resize', async () => {
    const src = (await import('./SwimlaneCanvas.vue?raw')).default as string;
    expect(src).toMatch(/\.pr-swim-canvas\s*\{[^}]*cursor:\s*default/);
    expect(src).not.toMatch(/\.pr-swim-canvas\s*\{[^}]*cursor:\s*crosshair/);
    expect(src).toMatch(
      /\.pr-swim-canvas-wrap--over-event\s+\.pr-swim-canvas\s*\{[^}]*cursor:\s*pointer/,
    );
    expect(src).toMatch(
      /\.pr-swim-canvas-wrap--measure\s+\.pr-swim-canvas\s*\{[^}]*cursor:\s*col-resize/,
    );
  });
});
