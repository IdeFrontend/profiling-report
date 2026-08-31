import { afterEach, describe, expect, it, vi } from 'vitest';
import { nextTick } from 'vue';
import { mount } from '@vue/test-utils';
import { formatDisplayTime } from '../../domain/formatTime';
import { createViewState } from '../../domain/viewState';
import SwimlaneCanvas from './SwimlaneView/SwimlaneCanvas/SwimlaneCanvas.vue';
import TimelineView from './TimelineView.vue';

/** ResizeObservers created by `stubAxisWidth` — re-fire after setting swimlane wrap size. */
const roHandles: { fire: () => void }[] = [];

function stubAxisWidth(widthPx: number) {
  roHandles.length = 0;
  class RO {
    private el: Element | null = null;
    constructor(private cb: ResizeObserverCallback) {
      roHandles.push(this);
    }
    observe(el: Element) {
      this.el = el;
      Object.defineProperty(el, 'clientWidth', {
        configurable: true,
        get: () => {
          const wrap = el.closest?.('[data-testid="swimlane"]') as HTMLElement | null;
          return wrap?.clientWidth || widthPx;
        },
      });
      this.fire();
    }
    fire() {
      if (!this.el) return;
      const wrap = this.el.closest?.('[data-testid="swimlane"]') as HTMLElement | null;
      const w = wrap?.clientWidth || widthPx;
      const h = wrap?.clientHeight || (this.el as HTMLElement).clientHeight || 1;
      // Axis/overview sync from clientWidth; canvas needs a positive device-pixel box.
      this.cb(
        [
          {
            target: this.el,
            devicePixelContentBoxSize: [{ inlineSize: w, blockSize: Math.max(1, h) }],
            contentBoxSize: [{ inlineSize: w, blockSize: Math.max(1, h) }],
            borderBoxSize: [],
            contentRect: this.el.getBoundingClientRect(),
          } as unknown as ResizeObserverEntry,
        ],
        this as unknown as ResizeObserver,
      );
    }
    unobserve() {}
    disconnect() {}
  }
  vi.stubGlobal('ResizeObserver', RO);
}

async function fireAllResizeObservers(): Promise<void> {
  await nextTick();
  for (const ro of roHandles) ro.fire();
  await nextTick();
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('TimelineView', () => {
  const baseProps = () => {
    const view = createViewState({
      minTime: 0,
      maxTime: 1000,
      processes: [],
    });
    return {
      bounds: { minTime: 0, maxTime: 1000 },
      view,
      timeScaleUnit: 'ms' as const,
      groups: [],
      collapsedIds: [] as string[],
      displaySwim: { minTime: 0, maxTime: 1000, processes: [] },
      cursor: null,
    };
  };

  it('PR-TIMELINE-001: renders overview, axis, and body', async () => {
    const wrapper = mount(TimelineView, { props: baseProps() });

    expect(wrapper.find('[data-testid="time-axis"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="gutter-resize-handle"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="lane-gutter"]').exists()).toBe(true);
    const src = (await import('./TimelineView.vue?raw')).default as string;
    expect(src).toMatch(
      /\.pr-swim-row\.pr-swim-row--head,\s*\.pr-swim-row\.pr-swim-row--overview\s*\{[^}]*z-index:\s*7/s,
    );
    expect(src).toMatch(
      /\.pr-swim-row\.pr-swim-row--head,\s*\.pr-swim-row\.pr-swim-row--overview\s*\{[^}]*overflow:\s*visible/s,
    );
  });

  it('PR-TIMELINE-002: measure mode keeps overview and draws axis bars + arrow', () => {
    stubAxisWidth(400);
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
        timeScaleUnit: 'ms',
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
    expect(wrapper.find('[data-testid="measure-label"]').text()).toMatch(/ns/);
  });

  it('PR-TIMELINE-003: measure drag on time axis emits update:measure-range', async () => {
    const view = createViewState({
      minTime: 0,
      maxTime: 1000,
      processes: [],
    });
    view.measureMode = true;
    const wrapper = mount(TimelineView, {
      props: {
        bounds: { minTime: 0, maxTime: 1000 },
        view,
        timeScaleUnit: 'ms',
        groups: [],
        collapsedIds: [],
        displaySwim: { minTime: 0, maxTime: 1000, processes: [] },
        cursor: null,
      },
    });
    const axis = wrapper.find('[data-testid="time-axis"]');
    const el = axis.element as HTMLElement;
    Object.defineProperty(el, 'getBoundingClientRect', {
      value: () => ({ left: 0, top: 0, width: 200, height: 20, right: 200, bottom: 20 }),
    });

    await axis.trigger('pointerdown', { clientX: 40, clientY: 10, button: 0, pointerId: 1 });
    window.dispatchEvent(new PointerEvent('pointermove', { clientX: 140, clientY: 10, buttons: 1 }));
    window.dispatchEvent(new PointerEvent('pointerup', { clientX: 140, clientY: 10 }));

    const ranges = wrapper.emitted('update:measure-range');
    expect(ranges?.length).toBeGreaterThan(0);
    const last = ranges![ranges!.length - 1][0] as { startTime: number; endTime: number };
    expect(last.endTime).toBeGreaterThan(last.startTime);

    // Cursor follows the drag pointer (not stuck at the press x).
    const cursors = wrapper.emitted('cursor') ?? [];
    expect(cursors.length).toBeGreaterThan(0);
    const lastCursor = cursors[cursors.length - 1][0] as { time: number; xRatio: number };
    expect(lastCursor.xRatio).toBeCloseTo(0.7, 5);

    const countAfterUp = ranges!.length;
    window.dispatchEvent(new PointerEvent('pointermove', { clientX: 180, clientY: 10, buttons: 0 }));
    expect(wrapper.emitted('update:measure-range')!.length).toBe(countAfterUp);
  });

  it('PR-TIMELINE-004: measure arrow sharp miter chevrons, 1px tip gap, shaft meets arms', () => {
    stubAxisWidth(400);
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
        timeScaleUnit: 'ms',
        groups: [],
        collapsedIds: [],
        displaySwim: { minTime: 0, maxTime: 1000, processes: [] },
        cursor: null,
      },
    });

    const arrow = wrapper.get('[data-testid="measure-arrow"]');
    expect(arrow.classes()).not.toContain('pr-measure-arrow--outside');
    expect(arrow.classes()).not.toContain('pr-measure-arrow--shaft');

    const heads = wrapper.findAll('[data-testid="measure-arrow-head"]');
    expect(heads).toHaveLength(2);
    for (const head of heads) {
      const path = head.find('path');
      expect(path.attributes('fill')).toBe('none');
      expect(path.attributes('stroke-width')).toBe('1.5');
      expect(path.attributes('stroke-linejoin')).toBe('miter');
    }

    expect(wrapper.findAll('[data-testid="measure-arrow-shaft"]')).toHaveLength(2);

    return import('./MeasureDtArrow.vue?raw').then((mod) => {
      const src = mod.default as string;
      expect(src).toMatch(/\.pr-measure-arrow\s*\{[^}]*padding:\s*0 1px/);
      expect(src).toMatch(/\.pr-measure-arrow__shaft--left\s*\{[^}]*margin-right:\s*4px/);
      expect(src).toMatch(/\.pr-measure-arrow__shaft--right\s*\{[^}]*margin-left:\s*4px/);
      expect(src).toMatch(/\.pr-measure-arrow__shaft\s*\{[^}]*height:\s*1\.5px/);
      expect(src).toMatch(/\.pr-measure-arrow\s*\{[^}]*color:\s*rgba\(49,\s*122,\s*247,\s*1\)/);
    });
  });

  it('PR-TIMELINE-005: narrow selection keeps outside label and two-sided arrow', async () => {
    stubAxisWidth(400);
    const view = createViewState({
      minTime: 0,
      maxTime: 1000,
      processes: [],
    });
    view.measureMode = true;
    // 8% of 400px = 32px — fits both heads (≥20) but not chrome + label.
    view.measureRange = { startTime: 0, endTime: 80 };
    const wrapper = mount(TimelineView, {
      props: {
        bounds: { minTime: 0, maxTime: 1000 },
        view,
        timeScaleUnit: 'ms',
        groups: [],
        collapsedIds: [],
        displaySwim: { minTime: 0, maxTime: 1000, processes: [] },
        cursor: null,
      },
    });
    await wrapper.vm.$nextTick();

    const arrow = wrapper.get('[data-testid="measure-arrow"]');
    expect(arrow.classes()).toContain('pr-measure-arrow--outside');
    expect(arrow.classes()).toContain('pr-measure-arrow--outside-right');
    expect(arrow.classes()).not.toContain('pr-measure-arrow--shaft');
    expect(wrapper.findAll('[data-testid="measure-arrow-head"]')).toHaveLength(2);
    expect(wrapper.findAll('[data-testid="measure-arrow-shaft"]')).toHaveLength(2);
    expect(wrapper.find('[data-testid="measure-axis-bar-left"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="measure-axis-bar-right"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="measure-label"]').exists()).toBe(true);
  });

  it('PR-TIMELINE-008: overlapping heads hide shaft; outside label only', async () => {
    stubAxisWidth(400);
    const view = createViewState({
      minTime: 0,
      maxTime: 1000,
      processes: [],
    });
    view.measureMode = true;
    // 1% of 400px = 4px — below MEASURE_HEADS_MIN_PX (20).
    view.measureRange = { startTime: 0, endTime: 10 };
    const wrapper = mount(TimelineView, {
      props: {
        bounds: { minTime: 0, maxTime: 1000 },
        view,
        timeScaleUnit: 'ms',
        groups: [],
        collapsedIds: [],
        displaySwim: { minTime: 0, maxTime: 1000, processes: [] },
        cursor: null,
      },
    });
    await wrapper.vm.$nextTick();

    const arrow = wrapper.get('[data-testid="measure-arrow"]');
    expect(arrow.classes()).toContain('pr-measure-arrow--outside');
    expect(arrow.classes()).toContain('pr-measure-arrow--shaft');
    expect(arrow.classes()).toContain('pr-measure-arrow--outside-right');
    expect(wrapper.findAll('[data-testid="measure-arrow-head"]')).toHaveLength(2);
    expect(wrapper.findAll('[data-testid="measure-arrow-shaft"]')).toHaveLength(2);
    const src = (await import('./MeasureDtArrow.vue?raw')).default as string;
    expect(src).toMatch(
      /\.pr-measure-arrow--shaft\s+\.pr-measure-arrow__head[\s\S]*?\.pr-measure-arrow--shaft\s+\.pr-measure-arrow__shaft\s*\{[^}]*display:\s*none/,
    );
    expect(wrapper.find('[data-testid="measure-label"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="measure-axis-bar-left"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="measure-axis-bar-right"]').exists()).toBe(true);
  });

  it('PR-TIMELINE-006: measure axis hides bars/heads for edges clamped outside the view', () => {
    stubAxisWidth(400);
    const view = createViewState({
      minTime: 0,
      maxTime: 1000,
      processes: [],
    });
    view.startTime = 200;
    view.endTime = 600;
    view.measureMode = true;
    view.measureRange = { startTime: 100, endTime: 800 };
    const wrapper = mount(TimelineView, {
      props: {
        bounds: { minTime: 0, maxTime: 1000 },
        view,
        timeScaleUnit: 'ms',
        groups: [],
        collapsedIds: [],
        displaySwim: { minTime: 0, maxTime: 1000, processes: [] },
        cursor: null,
      },
    });

    // Both true edges are outside — no fake bars at the view boundary.
    expect(wrapper.find('[data-testid="measure-axis-bar-left"]').exists()).toBe(false);
    expect(wrapper.find('[data-testid="measure-axis-bar-right"]').exists()).toBe(false);
    expect(wrapper.find('[data-testid="measure-arrow-head"]').exists()).toBe(false);
    expect(wrapper.find('[data-testid="measure-label"]').text()).toMatch(/ns/);
    expect(wrapper.find('[data-testid="measure-arrow"]').exists()).toBe(true);
  });

  it('PR-TIMELINE-006b: partial clip shows only the in-view measure edge', () => {
    stubAxisWidth(400);
    const view = createViewState({
      minTime: 0,
      maxTime: 1000,
      processes: [],
    });
    view.startTime = 200;
    view.endTime = 600;
    view.measureMode = true;
    view.measureRange = { startTime: 100, endTime: 500 };
    const wrapper = mount(TimelineView, {
      props: {
        bounds: { minTime: 0, maxTime: 1000 },
        view,
        timeScaleUnit: 'ms',
        groups: [],
        collapsedIds: [],
        displaySwim: { minTime: 0, maxTime: 1000, processes: [] },
        cursor: null,
      },
    });

    expect(wrapper.find('[data-testid="measure-axis-bar-left"]').exists()).toBe(false);
    const right = wrapper.get('[data-testid="measure-axis-bar-right"]');
    expect(right.attributes('style')).toMatch(/left:\s*75%/);
    expect(wrapper.findAll('[data-testid="measure-arrow-head"]')).toHaveLength(1);
  });

  it('PR-TIMELINE-007: measure axis shows near-edge cue when range is fully outside the view', () => {
    stubAxisWidth(400);
    const view = createViewState({
      minTime: 0,
      maxTime: 1000,
      processes: [],
    });
    view.startTime = 400;
    view.endTime = 600;
    view.measureMode = true;
    view.measureRange = { startTime: 0, endTime: 100 };
    const wrapper = mount(TimelineView, {
      props: {
        bounds: { minTime: 0, maxTime: 1000 },
        view,
        timeScaleUnit: 'ms',
        groups: [],
        collapsedIds: [],
        displaySwim: { minTime: 0, maxTime: 1000, processes: [] },
        cursor: null,
      },
    });

    // Chevron + Δt only — no vertical bar at the view edge.
    expect(wrapper.find('[data-testid="measure-axis-bar-left"]').exists()).toBe(false);
    expect(wrapper.find('[data-testid="measure-axis-bar-right"]').exists()).toBe(false);
    expect(wrapper.find('[data-testid="measure-arrow"]').classes()).toContain(
      'pr-measure-arrow--offscreen-left',
    );
    expect(wrapper.findAll('[data-testid="measure-arrow-head"]')).toHaveLength(1);
    expect(wrapper.find('[data-testid="measure-label"]').exists()).toBe(true);

    view.measureRange = { startTime: 800, endTime: 900 };
    const wrapperRight = mount(TimelineView, {
      props: {
        bounds: { minTime: 0, maxTime: 1000 },
        view,
        timeScaleUnit: 'ms',
        groups: [],
        collapsedIds: [],
        displaySwim: { minTime: 0, maxTime: 1000, processes: [] },
        cursor: null,
      },
    });
    expect(wrapperRight.find('[data-testid="measure-axis-bar-left"]').exists()).toBe(false);
    expect(wrapperRight.find('[data-testid="measure-axis-bar-right"]').exists()).toBe(false);
    expect(wrapperRight.find('[data-testid="measure-arrow"]').classes()).toContain(
      'pr-measure-arrow--offscreen-right',
    );
    expect(wrapperRight.findAll('[data-testid="measure-arrow-head"]')).toHaveLength(1);
  });

  it('PR-TIMELINE-009: cursor label lifts when overlapping measure range, not when clear', async () => {
    stubAxisWidth(400);
    const view = createViewState({
      minTime: 0,
      maxTime: 1000,
      processes: [],
    });
    view.measureMode = true;
    view.measureRange = { startTime: 200, endTime: 800 };
    const wrapper = mount(TimelineView, {
      props: {
        bounds: { minTime: 0, maxTime: 1000 },
        view,
        timeScaleUnit: 'ms',
        groups: [],
        collapsedIds: [],
        displaySwim: { minTime: 0, maxTime: 1000, processes: [] },
        // Mid-shaft between inline Δt (~50%) and right bar (80%).
        cursor: { time: 650, xRatio: 0.65 },
      },
    });
    await wrapper.vm.$nextTick();

    expect(wrapper.get('[data-testid="cursor-label"]').classes()).toContain(
      'pr-cursor__label--above',
    );

    // Playhead just past right bar (80%); ~72px pill still crosses the border.
    await wrapper.setProps({ cursor: { time: 820, xRatio: 0.82 } });
    await wrapper.vm.$nextTick();
    expect(wrapper.get('[data-testid="cursor-label"]').classes()).toContain(
      'pr-cursor__label--above',
    );

    await wrapper.setProps({ cursor: { time: 50, xRatio: 0.05 } });
    await wrapper.vm.$nextTick();
    expect(wrapper.get('[data-testid="cursor-label"]').classes()).not.toContain(
      'pr-cursor__label--above',
    );
  });

  it('PR-TIMELINE-010: dragging axis measure bar resizes that edge', async () => {
    stubAxisWidth(400);
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
        timeScaleUnit: 'ms',
        groups: [],
        collapsedIds: [],
        displaySwim: { minTime: 0, maxTime: 1000, processes: [] },
        cursor: null,
      },
    });
    await wrapper.vm.$nextTick();

    const left = wrapper.get('[data-testid="measure-axis-bar-left"]');
    const axis = wrapper.find('[data-testid="time-axis"]').element as HTMLElement;
    Object.defineProperty(axis, 'getBoundingClientRect', {
      value: () => ({ left: 0, top: 0, width: 400, height: 20, right: 400, bottom: 20 }),
    });

    await left.trigger('pointerdown', { clientX: 80, clientY: 10, button: 0, pointerId: 1 });
    window.dispatchEvent(new PointerEvent('pointermove', { clientX: 120, clientY: 10, buttons: 1 }));
    window.dispatchEvent(new PointerEvent('pointerup', { clientX: 120, clientY: 10 }));

    const ranges = wrapper.emitted('update:measure-range');
    expect(ranges?.length).toBeGreaterThan(0);
    const last = ranges![ranges!.length - 1][0] as { startTime: number; endTime: number };
    expect(last.endTime).toBe(500);
    expect(last.startTime).toBeGreaterThan(200);
    expect(last.startTime).toBeLessThan(500);

    const countAfterUp = ranges!.length;
    window.dispatchEvent(new PointerEvent('pointermove', { clientX: 160, clientY: 10, buttons: 0 }));
    expect(wrapper.emitted('update:measure-range')!.length).toBe(countAfterUp);

    const src = (await import('./TimelineView.vue?raw')).default as string;
    expect(src).toMatch(/\.pr-measure-axis-bar\s*\{[^}]*width:\s*9px/);
    expect(src).toMatch(/\.pr-measure-axis-bar\s*\{[^}]*cursor:\s*col-resize/);
    expect(src).toMatch(/\.pr-measure-axis-bar::before\s*\{[^}]*width:\s*2px/);
  });

  it('PR-TIMELINE-011: hovering axis measure bar emits cursor stuck to that edge', async () => {
    stubAxisWidth(400);
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
        timeScaleUnit: 'ms',
        groups: [],
        collapsedIds: [],
        displaySwim: { minTime: 0, maxTime: 1000, processes: [] },
        cursor: null,
      },
    });
    await wrapper.vm.$nextTick();

    const right = wrapper.get('[data-testid="measure-axis-bar-right"]');
    await right.trigger('pointerenter', { clientX: 200, clientY: 10 });

    const cursors = wrapper.emitted('cursor');
    expect(cursors?.length).toBeGreaterThan(0);
    const last = cursors![cursors!.length - 1][0] as { time: number; xRatio: number };
    expect(last.time).toBe(500);
    expect(last.xRatio).toBeCloseTo(0.5, 5);
  });

  it('PR-TIMELINE-012: clicking Δt label emits focus-measure', async () => {
    stubAxisWidth(400);
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
        timeScaleUnit: 'ms',
        groups: [],
        collapsedIds: [],
        displaySwim: { minTime: 0, maxTime: 1000, processes: [] },
        cursor: null,
      },
    });
    await wrapper.get('[data-testid="measure-label"]').trigger('click');
    expect(wrapper.emitted('focus-measure')).toHaveLength(1);
  });

  it('PR-TIMELINE-013: hovering viewport axis emits cursor and lifts the timestamp', async () => {
    stubAxisWidth(400);
    const view = createViewState({
      minTime: 0,
      maxTime: 1000,
      processes: [],
    });
    const wrapper = mount(TimelineView, {
      props: {
        bounds: { minTime: 0, maxTime: 1000 },
        view,
        timeScaleUnit: 'ms',
        groups: [],
        collapsedIds: [],
        displaySwim: { minTime: 0, maxTime: 1000, processes: [] },
        cursor: null,
      },
    });
    const axis = wrapper.get('[data-testid="time-axis"]');
    Object.defineProperty(axis.element, 'getBoundingClientRect', {
      value: () => ({ left: 0, top: 0, width: 400, height: 20, right: 400, bottom: 20 }),
    });

    await axis.trigger('pointerenter', { clientX: 100, clientY: 10 });
    const cursors = wrapper.emitted('cursor');
    expect(cursors?.length).toBeGreaterThan(0);
    const last = cursors![cursors!.length - 1][0] as { time: number; xRatio: number };
    expect(last.xRatio).toBeCloseTo(0.25, 5);
    expect(last.time).toBeCloseTo(250, 5);

    await wrapper.setProps({ cursor: last });
    await wrapper.vm.$nextTick();
    expect(wrapper.get('[data-testid="cursor-label"]').classes()).toContain(
      'pr-cursor__label--above',
    );
    expect(wrapper.find('[data-testid="swim-cursor"]').exists()).toBe(true);
    expect(wrapper.get('[data-testid="swim-cursor"]').attributes('style')).toMatch(
      /left:\s*25%/,
    );

    await axis.trigger('pointerleave', { clientX: 100, clientY: -5, relatedTarget: null });
    const afterLeave = wrapper.emitted('cursor')!;
    expect(afterLeave[afterLeave.length - 1][0]).toBeNull();
  });

  it('PR-TIMELINE-014: axis measure drag magnetizes when pointer moves over swimlane', async () => {
    stubAxisWidth(400);
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
    const view = createViewState(eventModel);
    view.measureMode = true;
    const wrapper = mount(TimelineView, {
      attachTo: document.body,
      props: {
        bounds: { minTime: 0, maxTime: 1000 },
        view,
        timeScaleUnit: 'ms',
        groups: [
          {
            id: 'p-1',
            name: 'P',
            lanes: [{ id: 't-1', name: 'T', color: '#f00', utilization: 0 }],
          },
        ],
        collapsedIds: [],
        displaySwim: eventModel,
        cursor: null,
        gutterWidth: 280,
        preferRenderer: 'canvas',
      },
    });

    const axis = wrapper.get('[data-testid="time-axis"]');
    const canvasRect = { left: 280, top: 120, width: 400, height: 120 };
    Object.defineProperty(axis.element, 'getBoundingClientRect', {
      value: () => ({ left: 280, top: 80, width: 400, height: 20, right: 680, bottom: 100 }),
    });

    const canvas = wrapper.findComponent(SwimlaneCanvas);
    const wrap = wrapper.find('[data-testid="swimlane"]');
    Object.defineProperty(wrap.element, 'clientWidth', { value: canvasRect.width, configurable: true });
    Object.defineProperty(wrap.element, 'clientHeight', { value: canvasRect.height, configurable: true });
    Object.defineProperty(wrap.element, 'getBoundingClientRect', {
      value: () => ({
        left: canvasRect.left,
        top: canvasRect.top,
        width: canvasRect.width,
        height: canvasRect.height,
        right: canvasRect.left + canvasRect.width,
        bottom: canvasRect.top + canvasRect.height,
      }),
    });
    const canvasEl = wrapper.find('[data-testid="swimlane-canvas"]');
    Object.defineProperty(canvasEl.element, 'getBoundingClientRect', {
      value: () => ({
        left: canvasRect.left,
        top: canvasRect.top,
        width: canvasRect.width,
        height: canvasRect.height,
        right: canvasRect.left + canvasRect.width,
        bottom: canvasRect.top + canvasRect.height,
      }),
    });

    await wrapper.setProps({ displaySwim: { ...eventModel } });
    await fireAllResizeObservers();

    const rect = (
      canvas.vm as { eventScreenRect: (id: string) => { x: number; y: number; w: number; h: number } | null }
    ).eventScreenRect('e1')!;
    expect(rect).toBeTruthy();

    await axis.trigger('pointerdown', { clientX: 300, clientY: 90, button: 0, pointerId: 1 });
    window.dispatchEvent(new PointerEvent('pointermove', { clientX: 640, clientY: 90, buttons: 1 }));
    let ranges = wrapper.emitted('update:measure-range')!;
    let last = ranges.at(-1)![0] as { startTime: number; endTime: number };
    expect(last.endTime).toBeCloseTo(900, 0);

    window.dispatchEvent(
      new PointerEvent('pointermove', {
        clientX: canvasRect.left + rect.x + 4,
        clientY: canvasRect.top + rect.y + rect.h / 2,
        buttons: 1,
      }),
    );
    ranges = wrapper.emitted('update:measure-range')!;
    last = ranges.at(-1)![0] as { startTime: number; endTime: number };
    expect(last.startTime === 200 || last.endTime === 200).toBe(true);

    const cursors = wrapper.emitted('cursor')!;
    const magnetCursor = cursors.at(-1)![0] as { time: number; xRatio: number };
    expect(magnetCursor.time).toBeCloseTo(200, 0);
    expect(magnetCursor.xRatio).toBeCloseTo(0.2, 2);
    wrapper.unmount();
  });

  it('PR-TIMELINE-015: cursor label is relative to bounds.minTime when minTime ≠ 0', () => {
    const minTime = 986_000;
    const maxTime = 5_260_000;
    const view = createViewState({ minTime, maxTime, processes: [] });
    const wrapper = mount(TimelineView, {
      props: {
        bounds: { minTime, maxTime },
        view,
        timeScaleUnit: 'us',
        groups: [],
        collapsedIds: [],
        displaySwim: { minTime, maxTime, processes: [] },
        cursor: { time: 3_354_000, xRatio: 0.5 },
      },
    });

    expect(wrapper.find('[data-testid="cursor-label"]').text()).toBe(
      formatDisplayTime(3_354_000, minTime, 'us'),
    );
  });

  it('PR-TIMELINE-016: cursor timestamp aligns with time-proportional xRatio', () => {
    const props = baseProps();
    props.view = { ...props.view, startTime: 0, endTime: 1000 };
    const wrapper = mount(TimelineView, {
      props: {
        ...props,
        cursor: { time: 500, xRatio: 0.5 },
      },
    });
    const line = wrapper.get('[data-testid="cursor-line"]');
    expect(line.attributes('style')).toContain('left: 50%');
  });

  it('PR-TIMELINE-018: viewport axis shows coarse base deep in trace, not near origin', () => {
    stubAxisWidth(800);
    const near = mount(TimelineView, { props: baseProps() });
    expect(near.get('[data-testid="time-axis"]').find('[data-testid="axis-ruler-base"]').exists()).toBe(
      false,
    );
    near.unmount();

    const minTime = 0;
    const maxTime = 300_000_000_000;
    const view = createViewState({ minTime, maxTime, processes: [] });
    view.startTime = 236_256_145_000;
    view.endTime = 236_256_146_000;
    const deep = mount(TimelineView, {
      props: {
        bounds: { minTime, maxTime },
        view,
        timeScaleUnit: 'ns',
        groups: [],
        collapsedIds: [],
        displaySwim: { minTime, maxTime, processes: [] },
        cursor: null,
      },
    });
    expect(deep.get('[data-testid="time-axis"]').find('[data-testid="axis-ruler-base"]').exists()).toBe(
      true,
    );
    deep.unmount();
  });

  it('PR-TIMELINE-017: no viewport breakpoint; swim rows keep a non-zero track floor', async () => {
    const src = (await import('./TimelineView.vue?raw')).default as string;
    expect(src).not.toMatch(/@media\s*\(\s*max-width:\s*900px\s*\)/);
    expect(src).toMatch(
      /\.pr-swim-row\s*\{[^}]*grid-template-columns:\s*minmax\(0,\s*var\(--pr-gutter-width[^)]*\)\)\s*minmax\(80px,\s*1fr\)/s,
    );
    expect(src).toMatch(/\.pr-swim-row\s*\{[^}]*min-width:\s*0/s);
  });
});
