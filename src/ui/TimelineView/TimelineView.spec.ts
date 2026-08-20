import { afterEach, describe, expect, it, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import { createViewState } from '../../domain/viewState';
import TimelineView from './TimelineView.vue';

function stubAxisWidth(widthPx: number) {
  class RO {
    constructor(private cb: ResizeObserverCallback) {}
    observe(el: Element) {
      Object.defineProperty(el, 'clientWidth', {
        configurable: true,
        get: () => widthPx,
      });
      this.cb([], this as unknown as ResizeObserver);
    }
    unobserve() {}
    disconnect() {}
  }
  vi.stubGlobal('ResizeObserver', RO);
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('TimelineView', () => {
  it('PR-TIMELINE-001: renders overview, axis, and body', async () => {
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
        unit: 'ms',
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
        unit: 'ms',
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

    return import('./TimelineView.vue?raw').then((mod) => {
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
        unit: 'ms',
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
        unit: 'ms',
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
    const src = (await import('./TimelineView.vue?raw')).default as string;
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
        unit: 'ms',
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
    expect(wrapper.find('[data-testid="measure-label"]').text()).toMatch(/ms/);
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
        unit: 'ms',
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
        unit: 'ms',
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
        unit: 'ms',
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
        unit: 'ms',
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
        unit: 'ms',
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
    expect(src).toMatch(
      /\.pr-measure-axis-bar:hover::before[\s\S]*?width:\s*2px/,
    );
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
        unit: 'ms',
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
        unit: 'ms',
        groups: [],
        collapsedIds: [],
        displaySwim: { minTime: 0, maxTime: 1000, processes: [] },
        cursor: null,
      },
    });
    await wrapper.get('[data-testid="measure-label"]').trigger('click');
    expect(wrapper.emitted('focus-measure')).toHaveLength(1);
  });
});
