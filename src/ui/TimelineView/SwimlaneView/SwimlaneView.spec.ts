import { describe, expect, it, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import { createViewState } from '../../../domain/viewState';
import SwimlaneCanvas from './SwimlaneCanvas/SwimlaneCanvas.vue';
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

  it('PR-SWIMVIEW-002: Card strip covers full width and emits toggle-group', async () => {
    const view = createViewState({
      minTime: 0,
      maxTime: 1000,
      processes: [],
    });
    const wrapper = mount(SwimlaneView, {
      props: {
        groups: [
          {
            id: 'card0',
            name: 'Card0',
            lanes: [{ id: 'l1', name: 'Lane', color: '#f00', utilization: 0.5 }],
          },
        ],
        collapsedIds: [],
        model: {
          minTime: 0,
          maxTime: 1000,
          processes: [
            {
              id: 'card0',
              name: 'Card0',
              threads: [{ id: 'l1', name: 'Lane', events: [] }],
            },
          ],
        },
        view,
        selectedEventId: null,
        hoveredEventId: null,
        searchQuery: '',
      },
    });

    const strip = wrapper.get('[data-testid="card-strip-card0"]');
    expect(strip.attributes('aria-expanded')).toBe('true');
    expect(strip.text()).toContain('Card0');
    await strip.trigger('click');
    expect(wrapper.emitted('toggle-group')).toEqual([['card0']]);
  });

  it('PR-SWIMVIEW-003: body hosts gutter-resize-handle under card strips', async () => {
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

    expect(wrapper.find('[data-testid="gutter-resize-handle"]').exists()).toBe(true);
    const src = (await import('./SwimlaneView.vue?raw')).default as string;
    expect(src).toMatch(/\.pr-gutter-resize\s*\{[^}]*z-index:\s*5/);
    expect(src).toMatch(/\.pr-card-strips\s*\{[^}]*z-index:\s*8/);
    expect(src).toMatch(/\.pr-swim-row--body\s*\{[^}]*overflow:\s*hidden/s);
  });

  it('PR-SWIMVIEW-004: swim cursor stacks under card strips and below edge marks', async () => {
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

    expect(wrapper.find('[data-testid="swim-cursor"]').exists()).toBe(false);
    const viewSrc = (await import('./SwimlaneView.vue?raw')).default as string;
    expect(viewSrc).toMatch(/\.pr-card-strips\s*\{[^}]*z-index:\s*8/);
    expect(viewSrc).toMatch(/\.pr-alt-measure-cross-bridge\s*\{[^}]*z-index:\s*9/);
    const canvasSrc = (await import('./SwimlaneCanvas/SwimlaneCanvas.vue?raw')).default as string;
    expect(canvasSrc).toMatch(/\.pr-swim-cursor\s*\{[^}]*z-index:\s*9/);
    expect(canvasSrc).toMatch(/\.pr-alt-measure\s*\{[^}]*z-index:\s*9/);
    expect(canvasSrc).toMatch(/\.pr-alt-measure-anchor\s*\{[^}]*z-index:\s*9/);
    expect(canvasSrc).toMatch(/\.pr-measure-edge-mark\s*\{[^}]*z-index:\s*10/);
    expect(canvasSrc).toMatch(/\.pr-measure-edge-mark--snap\s*\{[^}]*z-index:\s*11/);
    expect(canvasSrc).toMatch(/\.pr-measure-border\s*\{[^}]*z-index:\s*3/);
  });

  it('PR-SWIMVIEW-005: Card strip pointerenter clears swim cursor immediately', async () => {
    const view = createViewState({
      minTime: 0,
      maxTime: 1000,
      processes: [],
    });
    const wrapper = mount(SwimlaneView, {
      props: {
        groups: [
          {
            id: 'card0',
            name: 'Card0',
            lanes: [{ id: 'l1', name: 'Lane', color: '#f00', utilization: 0.5 }],
          },
        ],
        collapsedIds: [],
        model: {
          minTime: 0,
          maxTime: 1000,
          processes: [
            {
              id: 'card0',
              name: 'Card0',
              threads: [{ id: 'l1', name: 'Lane', events: [] }],
            },
          ],
        },
        view,
        selectedEventId: null,
        hoveredEventId: null,
        searchQuery: '',
      },
    });

    wrapper.findComponent(SwimlaneCanvas).vm.$emit('cursor', { time: 100, xRatio: 0.4 });
    await wrapper.vm.$nextTick();
    expect(wrapper.find('[data-testid="swim-cursor"]').exists()).toBe(true);

    await wrapper.get('[data-testid="card-strip-card0"]').trigger('pointerenter');
    expect(wrapper.find('[data-testid="swim-cursor"]').exists()).toBe(false);
    const cursorEmits = wrapper.emitted('cursor') ?? [];
    expect(cursorEmits[cursorEmits.length - 1]).toEqual([null]);
  });

  it('PR-SWIMVIEW-007: parent cursorXRatio prop shows the swim cursor bar', async () => {
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
        cursorXRatio: 0.3,
      },
    });
    await wrapper.vm.$nextTick();
    expect(wrapper.find('[data-testid="swim-cursor"]').exists()).toBe(true);
    expect(wrapper.get('[data-testid="swim-cursor"]').attributes('style')).toMatch(
      /left:\s*30%/,
    );
    await wrapper.setProps({ cursorXRatio: null });
    expect(wrapper.find('[data-testid="swim-cursor"]').exists()).toBe(false);
  });

  it('PR-SWIMVIEW-009: snapped cursor grays the swim vertical bar', async () => {
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
        cursorXRatio: 0.3,
        cursorSnapped: true,
      },
    });
    await wrapper.vm.$nextTick();
    const cursor = wrapper.get('[data-testid="swim-cursor"]');
    expect(cursor.classes()).toContain('pr-swim-cursor--snapped');
    await wrapper.setProps({ cursorSnapped: false });
    expect(wrapper.get('[data-testid="swim-cursor"]').classes()).not.toContain(
      'pr-swim-cursor--snapped',
    );
  });

  it('PR-SWIMVIEW-006: card strip fill/hover bind to LANE_GROUP_HEADER tokens', async () => {
    const { LANE_GROUP_HEADER_FILL, LANE_GROUP_HEADER_HOVER } = await import(
      '../../../swimlane/layout'
    );
    expect(LANE_GROUP_HEADER_FILL).toBe('#2a2a2a');
    expect(LANE_GROUP_HEADER_HOVER).toBe('#323232');

    const view = createViewState({
      minTime: 0,
      maxTime: 1000,
      processes: [],
    });
    const wrapper = mount(SwimlaneView, {
      props: {
        groups: [
          {
            id: 'card0',
            name: 'Card0',
            lanes: [{ id: 'l1', name: 'Lane', color: '#f00', utilization: 0.5 }],
          },
        ],
        collapsedIds: [],
        model: {
          minTime: 0,
          maxTime: 1000,
          processes: [
            {
              id: 'card0',
              name: 'Card0',
              threads: [{ id: 'l1', name: 'Lane', events: [] }],
            },
          ],
        },
        view,
        selectedEventId: null,
        hoveredEventId: null,
        searchQuery: '',
      },
    });

    const strips = wrapper.get('[data-testid="card-strips"]');
    expect(strips.attributes('style')).toContain(`--pr-card-header-fill: ${LANE_GROUP_HEADER_FILL}`);
    expect(strips.attributes('style')).toContain(
      `--pr-card-header-hover: ${LANE_GROUP_HEADER_HOVER}`,
    );

    const src = (await import('./SwimlaneView.vue?raw')).default as string;
    expect(src).toMatch(/background:\s*var\(--pr-card-header-fill\)/);
    expect(src).toMatch(/background:\s*var\(--pr-card-header-hover\)/);
    expect(src).not.toMatch(/background:\s*rgb\(42,\s*42,\s*42\)/);
    expect(src).not.toMatch(/background:\s*rgb\(50,\s*50,\s*50\)/);
  });

  it('PR-SWIMVIEW-008: overlays pin to used grid columns; track has non-zero floor', async () => {
    const src = (await import('./SwimlaneView.vue?raw')).default as string;
    expect(src).toMatch(
      /\.pr-swim-row\s*\{[^}]*grid-template-columns:\s*minmax\(0,\s*var\(--pr-gutter-width[^)]*\)\)\s*minmax\(80px,\s*1fr\)/s,
    );
    // Abspos: end line must be explicit (`1 / 2`); bare `1` → auto → container edge.
    expect(src).toMatch(/\.pr-gutter-resize\s*\{[^}]*grid-column:\s*1\s*\/\s*2/s);
    expect(src).toMatch(/\.pr-gutter-resize\s*\{[^}]*right:\s*0/s);
    expect(src).not.toMatch(/\.pr-gutter-resize\s*\{[^}]*left:\s*var\(--pr-gutter-width/s);
  });

  it('PR-SWIMVIEW-013: pinned lanes render in a sticky strip above the scroll body', () => {
    const view = createViewState({
      minTime: 0,
      maxTime: 1000,
      processes: [],
    });
    view.pinnedLaneIds = ['l1'];
    const wrapper = mount(SwimlaneView, {
      props: {
        groups: [
          {
            id: 'card0',
            name: 'Card0',
            lanes: [{ id: 'l1', name: 'Lane', color: '#f00', utilization: 0.5 }],
          },
        ],
        collapsedIds: [],
        pinnedLaneIds: ['l1'],
        model: {
          minTime: 0,
          maxTime: 1000,
          processes: [
            {
              id: 'card0',
              name: 'Card0',
              threads: [{ id: 'l1', name: 'Lane', events: [] }],
            },
          ],
        },
        view,
        selectedEventId: null,
        hoveredEventId: null,
        searchQuery: '',
      },
    });
    expect(wrapper.find('[data-testid="pinned-strip"]').exists()).toBe(true);
    expect(wrapper.find('.pr-swim-row--body').exists()).toBe(true);
  });

  it('PR-SWIMVIEW-025: pinned strip appears/disappears with a 200ms height transition', async () => {
    const src = (await import('./SwimlaneView.vue?raw')).default as string;
    expect(src).toMatch(/\.pr-pinned-strip\s*\{[^}]*height:\s*var\(--pr-pinned-h[^)]*\)/s);
    expect(src).toMatch(/\.pr-pinned-strip\s*\{[^}]*transition:\s*height\s+200ms\s+ease/s);
    // Enter/leave collapse the strip so appearing never jumps the body below it.
    expect(src).toMatch(
      /\.pr-pinned-strip\.pr-pinned-enter-from,[\s\S]*?\.pr-pinned-strip\.pr-pinned-leave-to\s*\{[^}]*height:\s*0/s,
    );
    expect(src).toMatch(/prefers-reduced-motion:\s*reduce/);
  });

  it('PR-SWIMVIEW-026: collapse tween slides canvas + Card strips + gutter', async () => {
    const src = (await import('./SwimlaneView.vue?raw')).default as string;
    // Forwards the tween to the body canvas and the gutter.
    expect(src).toMatch(/:collapse-anim="collapseAnim"/);
    // Card strips below a collapsing Card shift up by the same offset as the canvas.
    expect(src).toMatch(/anim\.hiddenHeight \* \(1 - anim\.visible\)/);
    expect(src).toMatch(/LANE_GROUP_HEADER_HEIGHT/);
  });

  it('PR-SWIMVIEW-014: pinned duplicates keep the same lane ids as originals', () => {
    const view = createViewState({
      minTime: 0,
      maxTime: 1000,
      processes: [],
    });
    const wrapper = mount(SwimlaneView, {
      props: {
        groups: [
          {
            id: 'card0',
            name: 'Card0',
            lanes: [{ id: 'l1', name: 'Lane', color: '#f00', utilization: 0.5 }],
          },
        ],
        collapsedIds: [],
        pinnedLaneIds: ['l1'],
        model: {
          minTime: 0,
          maxTime: 1000,
          processes: [
            {
              id: 'card0',
              name: 'Card0',
              threads: [{ id: 'l1', name: 'Lane', events: [] }],
            },
          ],
        },
        view,
        selectedEventId: null,
        hoveredEventId: null,
        searchQuery: '',
      },
    });
    expect(wrapper.findAll('[data-testid="gutter-lane-l1"]')).toHaveLength(2);
  });

  it('PR-SWIMVIEW-015: unpinned originals remain in tree order below the pinned strip', () => {
    const view = createViewState({
      minTime: 0,
      maxTime: 1000,
      processes: [],
    });
    const wrapper = mount(SwimlaneView, {
      props: {
        groups: [
          {
            id: 'card0',
            name: 'Card0',
            lanes: [
              { id: 'l1', name: 'A', color: '#f00', utilization: 0.5 },
              { id: 'l2', name: 'B', color: '#0f0', utilization: 0.5 },
            ],
          },
        ],
        collapsedIds: [],
        pinnedLaneIds: ['l2'],
        model: {
          minTime: 0,
          maxTime: 1000,
          processes: [
            {
              id: 'card0',
              name: 'Card0',
              threads: [
                { id: 'l1', name: 'A', events: [] },
                { id: 'l2', name: 'B', events: [] },
              ],
            },
          ],
        },
        view,
        selectedEventId: null,
        hoveredEventId: null,
        searchQuery: '',
      },
    });
    const body = wrapper.get('.pr-swim-row--body');
    expect(body.find('[data-testid="gutter-lane-l1"]').exists()).toBe(true);
    expect(body.find('[data-testid="gutter-lane-l2"]').exists()).toBe(true);
    expect(wrapper.get('[data-testid="pinned-gutter"]').find('[data-testid="gutter-lane-l2"]').exists()).toBe(
      true,
    );
  });

  it('PR-SWIMVIEW-016: pinned strip canvas omits dependency link rendering', async () => {
    const view = createViewState({
      minTime: 0,
      maxTime: 1000,
      processes: [],
    });
    const measureRange = { startTime: 100, endTime: 400 };
    const wrapper = mount(SwimlaneView, {
      props: {
        groups: [
          {
            id: 'card0',
            name: 'Card0',
            lanes: [{ id: 'l1', name: 'Lane', color: '#f00', utilization: 0.5 }],
          },
        ],
        collapsedIds: [],
        pinnedLaneIds: ['l1'],
        model: {
          minTime: 0,
          maxTime: 1000,
          processes: [
            {
              id: 'card0',
              name: 'Card0',
              threads: [{ id: 'l1', name: 'Lane', events: [] }],
            },
          ],
        },
        view,
        selectedEventId: null,
        hoveredEventId: null,
        searchQuery: '',
        measureMode: true,
        measureRange,
      },
    });
    const canvases = wrapper.findAllComponents(SwimlaneCanvas);
    const pinned = canvases.find((c) => c.attributes('data-testid') === 'pinned-canvas');
    expect(pinned).toBeTruthy();
    expect(pinned!.props('showDependencies')).toBe(false);
    expect(pinned!.props('measureMode')).toBe(true);
    expect(pinned!.props('measureRange')).toEqual(measureRange);
  });

  it('PR-SWIMVIEW-017: pinnedLaneIds may span multiple Cards; strip follows pin order', () => {
    const view = createViewState({
      minTime: 0,
      maxTime: 1000,
      processes: [],
    });
    const wrapper = mount(SwimlaneView, {
      props: {
        groups: [
          {
            id: 'card0',
            name: 'Card0',
            lanes: [{ id: 'l1', name: 'A', color: '#f00', utilization: 0.5 }],
          },
          {
            id: 'card1',
            name: 'Card1',
            lanes: [{ id: 'l2', name: 'B', color: '#0f0', utilization: 0.5 }],
          },
        ],
        collapsedIds: [],
        pinnedLaneIds: ['l2', 'l1'],
        model: {
          minTime: 0,
          maxTime: 1000,
          processes: [
            {
              id: 'card0',
              name: 'Card0',
              threads: [{ id: 'l1', name: 'A', events: [] }],
            },
            {
              id: 'card1',
              name: 'Card1',
              threads: [{ id: 'l2', name: 'B', events: [] }],
            },
          ],
        },
        view,
        selectedEventId: null,
        hoveredEventId: null,
        searchQuery: '',
      },
    });
    const pinnedLanes = wrapper
      .get('[data-testid="pinned-gutter"]')
      .findAll('[data-testid^="gutter-lane-"]');
    expect(pinnedLanes.map((n) => n.attributes('data-testid'))).toEqual([
      'gutter-lane-l2',
      'gutter-lane-l1',
    ]);
  });

  it('PR-SWIMVIEW-018: measure magnet routes by pointer Y across pin strip and body', () => {
    const view = createViewState({
      minTime: 0,
      maxTime: 1000,
      processes: [],
    });
    const wrapper = mount(SwimlaneView, {
      props: {
        groups: [
          {
            id: 'card0',
            name: 'Card0',
            lanes: [{ id: 'l1', name: 'Lane', color: '#f00', utilization: 0.5 }],
          },
        ],
        collapsedIds: [],
        pinnedLaneIds: ['l1'],
        model: {
          minTime: 0,
          maxTime: 1000,
          processes: [
            {
              id: 'card0',
              name: 'Card0',
              threads: [{ id: 'l1', name: 'Lane', events: [] }],
            },
          ],
        },
        view,
        selectedEventId: null,
        hoveredEventId: null,
        searchQuery: '',
      },
      attachTo: document.body,
    });

    const stripEl = wrapper.get('[data-testid="pinned-strip"]').element as HTMLElement;
    vi.spyOn(stripEl, 'getBoundingClientRect').mockReturnValue({
      x: 0,
      y: 0,
      top: 0,
      bottom: 40,
      left: 0,
      right: 200,
      width: 200,
      height: 40,
      toJSON() {
        return {};
      },
    });

    const canvases = wrapper.findAllComponents(SwimlaneCanvas);
    const pinned = canvases.find((c) => c.attributes('data-testid') === 'pinned-canvas');
    const body = canvases.find((c) => c.attributes('data-testid') !== 'pinned-canvas');
    expect(pinned).toBeTruthy();
    expect(body).toBeTruthy();

    type Mag = { time: number; xPx: number; xRatio: number; eventId: string | null };
    type CanvasExposed = {
      magnetizeAtClientLocal: (clientX: number, clientY: number) => Mag | null;
      clearEdgeSnapHighlight: () => void;
    };
    const pinnedExposed = (pinned!.vm as unknown as { $: { exposed: CanvasExposed } }).$.exposed;
    const bodyExposed = (body!.vm as unknown as { $: { exposed: CanvasExposed } }).$.exposed;

    const pinnedLocal = vi
      .spyOn(pinnedExposed, 'magnetizeAtClientLocal')
      .mockReturnValue({ time: 10, xPx: 1, xRatio: 0.1, eventId: 'pin-ev' });
    const bodyLocal = vi
      .spyOn(bodyExposed, 'magnetizeAtClientLocal')
      .mockReturnValue({ time: 20, xPx: 2, xRatio: 0.2, eventId: 'body-ev' });

    const viewVm = wrapper.vm as {
      magnetizeAtClient: (x: number, y: number) => Mag | null;
    };

    expect(viewVm.magnetizeAtClient(10, 20)).toMatchObject({ eventId: 'pin-ev' });
    expect(pinnedLocal).toHaveBeenCalled();
    expect(bodyLocal).not.toHaveBeenCalled();

    pinnedLocal.mockClear();
    bodyLocal.mockClear();

    expect(viewVm.magnetizeAtClient(10, 60)).toMatchObject({ eventId: 'body-ev' });
    expect(bodyLocal).toHaveBeenCalled();
    expect(pinnedLocal).not.toHaveBeenCalled();

    wrapper.unmount();
  });

  it('PR-SWIMVIEW-020: Alt-measure works between pinned-strip and body events', async () => {
    const { nextTick } = await import('vue');
    const {
      ALT_MEASURE_FIND_EVENT_KEY,
      ALT_MEASURE_SHARED_KEY,
      createAltMeasureShared,
    } = await import('./altMeasureShared');

    // Same device-pixel RO stub as SwimlaneCanvas.spec.ts (layout needs a non-zero size).
    const roHandles: { fire: () => void }[] = [];
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
          this.cb(
            [
              {
                target: this.el,
                devicePixelContentBoxSize: [{ inlineSize: w, blockSize: h }],
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

    const model = {
      minTime: 0,
      maxTime: 1000,
      processes: [
        {
          id: 'card0',
          name: 'Card0',
          threads: [
            {
              id: 'l1',
              name: 'Pinned',
              events: [{ id: 'eA', name: 'a', startTime: 100, duration: 100 }],
            },
            {
              id: 'l2',
              name: 'Body',
              events: [{ id: 'eB', name: 'b', startTime: 400, duration: 100 }],
            },
          ],
        },
      ],
    };
    const view = { startTime: 0, endTime: 1000, scrollY: 0 };
    const pinnedModel = {
      minTime: 0,
      maxTime: 1000,
      skipCardHeaders: true as const,
      processes: [
        {
          id: 'pinned',
          name: '',
          threads: [
            {
              id: 'l1',
              name: 'Pinned',
              events: [{ id: 'eA', name: 'a', startTime: 100, duration: 100 }],
            },
          ],
        },
      ],
    };
    const shared = createAltMeasureShared();
    const findEvent = (id: string) => {
      for (const t of model.processes[0]!.threads) {
        const ev = t.events.find((e) => e.id === id);
        if (ev) return ev;
      }
      return null;
    };
    const provide = {
      [ALT_MEASURE_SHARED_KEY as symbol]: shared,
      [ALT_MEASURE_FIND_EVENT_KEY as symbol]: findEvent,
    };
    const nullProps = {
      selectedEventId: null,
      hoveredEventId: null,
      searchQuery: '',
      measureMode: false,
      measureRange: null,
      preferRenderer: 'canvas' as const,
      view,
    };

    async function sizeAndRefresh(wrapper: ReturnType<typeof mount>, modelProp: unknown) {
      const wrap = wrapper.find('[data-testid="swimlane"]').element as HTMLElement;
      Object.defineProperty(wrap, 'clientWidth', { value: 400, configurable: true });
      Object.defineProperty(wrap, 'clientHeight', { value: 120, configurable: true });
      Object.defineProperty(wrap, 'getBoundingClientRect', {
        value: () => ({ left: 0, top: 0, width: 400, height: 120, right: 400, bottom: 120 }),
      });
      const canvas = wrapper.find('[data-testid="swimlane-canvas"]').element as HTMLCanvasElement;
      Object.defineProperty(canvas, 'getBoundingClientRect', {
        value: () => ({ left: 0, top: 0, width: 400, height: 120, right: 400, bottom: 120 }),
      });
      await wrapper.setProps({ model: modelProp as never });
      await nextTick();
      for (const ro of roHandles) ro.fire();
      await nextTick();
    }

    const strip = mount(SwimlaneCanvas, {
      props: {
        ...nullProps,
        model: pinnedModel,
        altMeasureRole: 'strip',
        pinnedLaneIds: ['l1'],
      },
      global: { provide },
      attachTo: document.body,
    });
    const body = mount(SwimlaneCanvas, {
      props: {
        ...nullProps,
        model,
        altMeasureRole: 'body',
        pinnedLaneIds: ['l1'],
      },
      global: { provide },
      attachTo: document.body,
    });
    await sizeAndRefresh(strip, { ...pinnedModel });
    await sizeAndRefresh(body, { ...model });

    shared.anchorId = 'eA';
    shared.anchorSurface = 'strip';
    shared.target = { eventId: 'eB', time: 400, surface: 'body' };
    shared.pinned = true;
    shared.altKeyHeld = false;
    await nextTick();

    expect(strip.find('[data-testid="alt-event-measure"]').exists()).toBe(true);
    expect(body.find('[data-testid="alt-event-measure"]').exists()).toBe(true);
    expect(strip.find('[data-testid="measure-label"]').text()).toBe('200 ns');
    expect(body.find('[data-testid="measure-label"]').exists()).toBe(false);
    expect(body.find('[data-testid="alt-measure-stick-split"]').exists()).toBe(true);

    // Body-captured anchor on a pinned lane stays on the body instance (not the strip).
    shared.anchorSurface = 'body';
    shared.target = { eventId: 'eB', time: 400, surface: 'body' };
    await nextTick();
    expect(strip.find('[data-testid="alt-event-measure"]').exists()).toBe(false);
    expect(body.find('[data-testid="alt-event-measure"]').exists()).toBe(true);
    expect(body.find('[data-testid="alt-measure-anchor"]').exists()).toBe(true);

    strip.unmount();
    body.unmount();
    vi.unstubAllGlobals();
  });

  it('PR-SWIMVIEW-021: pin↔body Alt-measure draws a vertical cross bridge', async () => {
    const { nextTick } = await import('vue');
    const model = {
      minTime: 0,
      maxTime: 1000,
      processes: [
        {
          id: 'card0',
          name: 'Card0',
          threads: [
            {
              id: 'l1',
              name: 'Pinned',
              events: [{ id: 'eA', name: 'a', startTime: 100, duration: 100 }],
            },
            {
              id: 'l2',
              name: 'Body',
              events: [{ id: 'eB', name: 'b', startTime: 400, duration: 100 }],
            },
          ],
        },
      ],
    };
    const view = createViewState(model);
    const wrapper = mount(SwimlaneView, {
      props: {
        groups: [
          {
            id: 'card0',
            name: 'Card0',
            lanes: [
              { id: 'l1', name: 'Pinned', color: '#f00', utilization: 0.5 },
              { id: 'l2', name: 'Body', color: '#0f0', utilization: 0.5 },
            ],
          },
        ],
        collapsedIds: [],
        pinnedLaneIds: ['l1'],
        model,
        pinSourceModel: model,
        view,
        selectedEventId: null,
        hoveredEventId: null,
        searchQuery: '',
        preferRenderer: 'canvas' as const,
      },
      attachTo: document.body,
    });

    const stack = wrapper.find('.pr-swim-stack').element as HTMLElement;
    Object.defineProperty(stack, 'getBoundingClientRect', {
      configurable: true,
      value: () => ({ left: 0, top: 0, width: 680, height: 220, right: 680, bottom: 220 }),
    });

    const canvases = wrapper.findAllComponents(SwimlaneCanvas);
    expect(canvases.length).toBe(2);
    type Bridge = { clientX: number; clientY: number; time: number } | null;
    type Exposed = { altMeasureBridgeEndpoint: () => Bridge };
    for (const c of canvases) {
      const exposed = (c.vm as unknown as { $: { exposed: Exposed } }).$.exposed;
      const isPin = c.attributes('data-testid') === 'pinned-canvas';
      vi.spyOn(exposed, 'altMeasureBridgeEndpoint').mockReturnValue({
        clientX: 400,
        clientY: isPin ? 30 : 150,
        time: isPin ? 200 : 400,
      });
    }

    const shared = (wrapper.vm as unknown as { altMeasureShared: {
      anchorId: string | null;
      anchorSurface: 'strip' | 'body' | 'solo' | null;
      target: { eventId: string; time: number; surface: 'strip' | 'body' | 'solo' } | null;
      pinned: boolean;
      altKeyHeld: boolean;
    } }).altMeasureShared;
    shared.anchorId = 'eA';
    shared.anchorSurface = 'strip';
    shared.target = { eventId: 'eB', time: 400, surface: 'body' };
    shared.pinned = true;
    shared.altKeyHeld = false;
    await nextTick();

    expect(wrapper.find('[data-testid="alt-measure-cross-bridge"]').exists()).toBe(true);
    const bridge = wrapper.get('[data-testid="alt-measure-cross-bridge"]');
    const style = bridge.attributes('style') ?? '';
    const h = Number(/height:\s*([\d.]+)px/.exec(style)?.[1] ?? 0);
    expect(h).toBe(120);

    wrapper.unmount();
  });

  it('PR-SWIMVIEW-021: pin↔body bridge re-projects on gutter resize', async () => {
    const { nextTick } = await import('vue');
    const model = {
      minTime: 0,
      maxTime: 1000,
      processes: [
        {
          id: 'card0',
          name: 'Card0',
          threads: [
            {
              id: 'l1',
              name: 'Pinned',
              events: [{ id: 'eA', name: 'a', startTime: 100, duration: 100 }],
            },
            {
              id: 'l2',
              name: 'Body',
              events: [{ id: 'eB', name: 'b', startTime: 400, duration: 100 }],
            },
          ],
        },
      ],
    };
    const view = createViewState(model);
    const wrapper = mount(SwimlaneView, {
      props: {
        groups: [
          {
            id: 'card0',
            name: 'Card0',
            lanes: [
              { id: 'l1', name: 'Pinned', color: '#f00', utilization: 0.5 },
              { id: 'l2', name: 'Body', color: '#0f0', utilization: 0.5 },
            ],
          },
        ],
        collapsedIds: [],
        pinnedLaneIds: ['l1'],
        gutterWidth: 240,
        model,
        pinSourceModel: model,
        view,
        selectedEventId: null,
        hoveredEventId: null,
        searchQuery: '',
        preferRenderer: 'canvas' as const,
      },
      attachTo: document.body,
    });

    const stack = wrapper.find('.pr-swim-stack').element as HTMLElement;
    Object.defineProperty(stack, 'getBoundingClientRect', {
      configurable: true,
      value: () => ({ left: 0, top: 0, width: 680, height: 220, right: 680, bottom: 220 }),
    });

    const canvases = wrapper.findAllComponents(SwimlaneCanvas);
    expect(canvases.length).toBe(2);
    let pinClientX = 400;
    type Bridge = { clientX: number; clientY: number; time: number } | null;
    type Exposed = { altMeasureBridgeEndpoint: () => Bridge };
    for (const c of canvases) {
      const exposed = (c.vm as unknown as { $: { exposed: Exposed } }).$.exposed;
      const isPin = c.attributes('data-testid') === 'pinned-canvas';
      vi.spyOn(exposed, 'altMeasureBridgeEndpoint').mockImplementation(() => ({
        clientX: isPin ? pinClientX : 480,
        clientY: isPin ? 30 : 150,
        time: isPin ? 400 : 200,
      }));
    }

    const shared = (wrapper.vm as unknown as { altMeasureShared: {
      anchorId: string | null;
      anchorSurface: 'strip' | 'body' | 'solo' | null;
      target: { eventId: string; time: number; surface: 'strip' | 'body' | 'solo' } | null;
      pinned: boolean;
      altKeyHeld: boolean;
    } }).altMeasureShared;
    shared.anchorId = 'eA';
    shared.anchorSurface = 'strip';
    shared.target = { eventId: 'eB', time: 400, surface: 'body' };
    shared.pinned = true;
    shared.altKeyHeld = false;
    await nextTick();

    const bridge = wrapper.get('[data-testid="alt-measure-cross-bridge"]');
    const leftOf = () => Number(/left:\s*([\d.]+)px/.exec(bridge.attributes('style') ?? '')?.[1] ?? NaN);
    expect(leftOf()).toBe(400);

    pinClientX = 520;
    await wrapper.setProps({ gutterWidth: 300 });
    await nextTick();
    expect(leftOf()).toBe(520);

    wrapper.unmount();
  });

  it('PR-SWIMVIEW-021: pin↔body bridge survives when one edge is time-clipped', async () => {
    const { nextTick } = await import('vue');
    const {
      ALT_MEASURE_FIND_EVENT_KEY,
      ALT_MEASURE_SHARED_KEY,
      createAltMeasureShared,
    } = await import('./altMeasureShared');

    const roHandles: { fire: () => void }[] = [];
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
          this.cb(
            [
              {
                target: this.el,
                devicePixelContentBoxSize: [{ inlineSize: w, blockSize: h }],
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

    const model = {
      minTime: 0,
      maxTime: 1000,
      processes: [
        {
          id: 'card0',
          name: 'Card0',
          threads: [
            {
              id: 'l1',
              name: 'Pinned',
              events: [{ id: 'eA', name: 'a', startTime: 100, duration: 100 }],
            },
            {
              id: 'l2',
              name: 'Body',
              events: [{ id: 'eB', name: 'b', startTime: 400, duration: 100 }],
            },
          ],
        },
      ],
    };
    // Clip the earlier edge (anchor end = 200) out of the window; later edge stays in.
    const view = { startTime: 300, endTime: 1000, scrollY: 0 };
    const pinnedModel = {
      minTime: 0,
      maxTime: 1000,
      skipCardHeaders: true as const,
      processes: [
        {
          id: 'pinned',
          name: '',
          threads: [
            {
              id: 'l1',
              name: 'Pinned',
              events: [{ id: 'eA', name: 'a', startTime: 100, duration: 100 }],
            },
          ],
        },
      ],
    };
    const shared = createAltMeasureShared();
    const findEvent = (id: string) => {
      for (const t of model.processes[0]!.threads) {
        const ev = t.events.find((e) => e.id === id);
        if (ev) return ev;
      }
      return null;
    };
    const provide = {
      [ALT_MEASURE_SHARED_KEY as symbol]: shared,
      [ALT_MEASURE_FIND_EVENT_KEY as symbol]: findEvent,
    };
    const nullProps = {
      selectedEventId: null,
      hoveredEventId: null,
      searchQuery: '',
      measureMode: false,
      measureRange: null,
      preferRenderer: 'canvas' as const,
      view,
    };

    async function sizeAndRefresh(wrapper: ReturnType<typeof mount>, modelProp: unknown) {
      const wrap = wrapper.find('[data-testid="swimlane"]').element as HTMLElement;
      Object.defineProperty(wrap, 'clientWidth', { value: 400, configurable: true });
      Object.defineProperty(wrap, 'clientHeight', { value: 120, configurable: true });
      Object.defineProperty(wrap, 'getBoundingClientRect', {
        value: () => ({ left: 0, top: 0, width: 400, height: 120, right: 400, bottom: 120 }),
      });
      const canvas = wrapper.find('[data-testid="swimlane-canvas"]').element as HTMLCanvasElement;
      Object.defineProperty(canvas, 'getBoundingClientRect', {
        value: () => ({ left: 0, top: 0, width: 400, height: 120, right: 400, bottom: 120 }),
      });
      await wrapper.setProps({ model: modelProp as never });
      await nextTick();
      for (const ro of roHandles) ro.fire();
      await nextTick();
    }

    const strip = mount(SwimlaneCanvas, {
      props: {
        ...nullProps,
        model: pinnedModel,
        altMeasureRole: 'strip',
        pinnedLaneIds: ['l1'],
      },
      global: { provide },
      attachTo: document.body,
    });
    const body = mount(SwimlaneCanvas, {
      props: {
        ...nullProps,
        model,
        altMeasureRole: 'body',
        pinnedLaneIds: ['l1'],
      },
      global: { provide },
      attachTo: document.body,
    });
    await sizeAndRefresh(strip, { ...pinnedModel });
    await sizeAndRefresh(body, { ...model });

    shared.anchorId = 'eA';
    shared.anchorSurface = 'strip';
    shared.target = { eventId: 'eB', time: 400, surface: 'body' };
    shared.pinned = true;
    shared.altKeyHeld = false;
    await nextTick();

    type Bridge = { clientX: number; clientY: number; time: number } | null;
    const stripEp = (
      strip.vm as unknown as { $: { exposed: { altMeasureBridgeEndpoint: () => Bridge } } }
    ).$.exposed.altMeasureBridgeEndpoint();
    const bodyEp = (
      body.vm as unknown as { $: { exposed: { altMeasureBridgeEndpoint: () => Bridge } } }
    ).$.exposed.altMeasureBridgeEndpoint();
    expect(stripEp).not.toBeNull();
    expect(bodyEp).not.toBeNull();
    // Earlier stick is clipped; local stick chrome may hide, but the bridge endpoint remains.
    expect(strip.find('[data-testid="alt-measure-stick-split"]').exists()).toBe(false);
    expect(body.find('[data-testid="alt-measure-stick-split"]').exists()).toBe(true);

    strip.unmount();
    body.unmount();
    vi.unstubAllGlobals();
  });

  it('PR-SWIMVIEW-024: strip/body pointerleave keeps ephemeral Alt target', async () => {
    const { nextTick } = await import('vue');
    const {
      ALT_MEASURE_FIND_EVENT_KEY,
      ALT_MEASURE_SHARED_KEY,
      createAltMeasureShared,
    } = await import('./altMeasureShared');

    const roHandles: { fire: () => void }[] = [];
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
          this.cb(
            [
              {
                target: this.el,
                devicePixelContentBoxSize: [{ inlineSize: w, blockSize: h }],
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

    const model = {
      minTime: 0,
      maxTime: 1000,
      processes: [
        {
          id: 'card0',
          name: 'Card0',
          threads: [
            {
              id: 'l1',
              name: 'Pinned',
              events: [{ id: 'eA', name: 'a', startTime: 100, duration: 100 }],
            },
            {
              id: 'l2',
              name: 'Body',
              events: [{ id: 'eB', name: 'b', startTime: 400, duration: 100 }],
            },
          ],
        },
      ],
    };
    const view = { startTime: 0, endTime: 1000, scrollY: 0 };
    const pinnedModel = {
      minTime: 0,
      maxTime: 1000,
      skipCardHeaders: true as const,
      processes: [
        {
          id: 'pinned',
          name: '',
          threads: [
            {
              id: 'l1',
              name: 'Pinned',
              events: [{ id: 'eA', name: 'a', startTime: 100, duration: 100 }],
            },
          ],
        },
      ],
    };
    const shared = createAltMeasureShared();
    const findEvent = (id: string) => {
      for (const t of model.processes[0]!.threads) {
        const ev = t.events.find((e) => e.id === id);
        if (ev) return ev;
      }
      return null;
    };
    const provide = {
      [ALT_MEASURE_SHARED_KEY as symbol]: shared,
      [ALT_MEASURE_FIND_EVENT_KEY as symbol]: findEvent,
    };
    const nullProps = {
      selectedEventId: null,
      hoveredEventId: null,
      searchQuery: '',
      measureMode: false,
      measureRange: null,
      preferRenderer: 'canvas' as const,
      view,
    };

    async function sizeAndRefresh(wrapper: ReturnType<typeof mount>, modelProp: unknown) {
      const wrap = wrapper.find('[data-testid="swimlane"]').element as HTMLElement;
      Object.defineProperty(wrap, 'clientWidth', { value: 400, configurable: true });
      Object.defineProperty(wrap, 'clientHeight', { value: 120, configurable: true });
      Object.defineProperty(wrap, 'getBoundingClientRect', {
        value: () => ({ left: 0, top: 0, width: 400, height: 120, right: 400, bottom: 120 }),
      });
      const canvas = wrapper.find('[data-testid="swimlane-canvas"]').element as HTMLCanvasElement;
      Object.defineProperty(canvas, 'getBoundingClientRect', {
        value: () => ({ left: 0, top: 0, width: 400, height: 120, right: 400, bottom: 120 }),
      });
      await wrapper.setProps({ model: modelProp as never });
      await nextTick();
      for (const ro of roHandles) ro.fire();
      await nextTick();
    }

    const strip = mount(SwimlaneCanvas, {
      props: {
        ...nullProps,
        model: pinnedModel,
        altMeasureRole: 'strip',
        pinnedLaneIds: ['l1'],
      },
      global: { provide },
      attachTo: document.body,
    });
    const body = mount(SwimlaneCanvas, {
      props: {
        ...nullProps,
        model,
        altMeasureRole: 'body',
        pinnedLaneIds: ['l1'],
      },
      global: { provide },
      attachTo: document.body,
    });
    await sizeAndRefresh(strip, { ...pinnedModel });
    await sizeAndRefresh(body, { ...model });

    shared.anchorId = 'eA';
    shared.anchorSurface = 'strip';
    shared.target = { eventId: 'eB', time: 400, surface: 'body' };
    shared.pinned = false;
    shared.altKeyHeld = true;
    await nextTick();
    expect(shared.target?.eventId).toBe('eB');

    await strip.find('[data-testid="swimlane-canvas"]').trigger('pointerleave', {
      clientX: 10,
      clientY: -5,
      pointerId: 1,
    });
    await nextTick();
    expect(shared.target?.eventId).toBe('eB');
    expect(shared.anchorId).toBe('eA');

    await body.find('[data-testid="swimlane-canvas"]').trigger('pointerleave', {
      clientX: 10,
      clientY: -5,
      pointerId: 1,
    });
    await nextTick();
    expect(shared.target?.eventId).toBe('eB');

    // Solo still clears ephemeral live preview on leave.
    const soloShared = createAltMeasureShared();
    const soloProvide = {
      [ALT_MEASURE_SHARED_KEY as symbol]: soloShared,
      [ALT_MEASURE_FIND_EVENT_KEY as symbol]: findEvent,
    };
    const solo = mount(SwimlaneCanvas, {
      props: {
        ...nullProps,
        model,
        altMeasureRole: 'solo',
        pinnedLaneIds: [],
      },
      global: { provide: soloProvide },
      attachTo: document.body,
    });
    await sizeAndRefresh(solo, { ...model });
    soloShared.anchorId = 'eA';
    soloShared.anchorSurface = 'solo';
    soloShared.target = { eventId: 'eB', time: 400, surface: 'solo' };
    soloShared.pinned = false;
    soloShared.altKeyHeld = true;
    await nextTick();
    await solo.find('[data-testid="swimlane-canvas"]').trigger('pointerleave', {
      clientX: 10,
      clientY: -5,
      pointerId: 1,
    });
    await nextTick();
    expect(soloShared.anchorId).toBe('eA');
    expect(soloShared.target).toBeNull();

    strip.unmount();
    body.unmount();
    solo.unmount();
    vi.unstubAllGlobals();
  });

  it('PR-SWIMVIEW-024: no-pin SwimlaneView clears ephemeral Alt target on leave', async () => {
    const { nextTick } = await import('vue');
    const model = {
      minTime: 0,
      maxTime: 1000,
      processes: [
        {
          id: 'card0',
          name: 'Card0',
          threads: [
            {
              id: 'l1',
              name: 'Lane',
              events: [
                { id: 'eA', name: 'a', startTime: 100, duration: 100 },
                { id: 'eB', name: 'b', startTime: 400, duration: 100 },
              ],
            },
          ],
        },
      ],
    };
    const view = createViewState(model);
    const wrapper = mount(SwimlaneView, {
      props: {
        groups: [
          {
            id: 'card0',
            name: 'Card0',
            lanes: [{ id: 'l1', name: 'Lane', color: '#f00', utilization: 0.5 }],
          },
        ],
        collapsedIds: [],
        pinnedLaneIds: [],
        model,
        view,
        selectedEventId: null,
        hoveredEventId: null,
        searchQuery: '',
        preferRenderer: 'canvas' as const,
      },
      attachTo: document.body,
    });

    expect(wrapper.find('[data-testid="pinned-canvas"]').exists()).toBe(false);
    const canvases = wrapper.findAllComponents(SwimlaneCanvas);
    expect(canvases.length).toBe(1);
    expect(canvases[0]!.props('altMeasureRole')).toBe('solo');

    const shared = (
      wrapper.vm as unknown as {
        altMeasureShared: {
          anchorId: string | null;
          anchorSurface: 'strip' | 'body' | 'solo' | null;
          target: { eventId: string; time: number; surface: 'strip' | 'body' | 'solo' } | null;
          pinned: boolean;
          altKeyHeld: boolean;
        };
      }
    ).altMeasureShared;
    shared.anchorId = 'eA';
    shared.anchorSurface = 'solo';
    shared.target = { eventId: 'eB', time: 400, surface: 'solo' };
    shared.pinned = false;
    shared.altKeyHeld = true;
    await nextTick();

    await wrapper.find('[data-testid="swimlane-canvas"]').trigger('pointerleave', {
      clientX: 10,
      clientY: -5,
      pointerId: 1,
    });
    await nextTick();
    expect(shared.anchorId).toBe('eA');
    expect(shared.target).toBeNull();

    wrapper.unmount();
  });

  it('PR-SWIMVIEW-022: free-cursor Alt target paints cursor line on strip and body', async () => {
    const { nextTick } = await import('vue');
    const {
      ALT_MEASURE_FIND_EVENT_KEY,
      ALT_MEASURE_SHARED_KEY,
      createAltMeasureShared,
    } = await import('./altMeasureShared');

    const roHandles: { fire: () => void }[] = [];
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
          this.cb(
            [
              {
                target: this.el,
                devicePixelContentBoxSize: [{ inlineSize: w, blockSize: h }],
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

    const model = {
      minTime: 0,
      maxTime: 1000,
      processes: [
        {
          id: 'card0',
          name: 'Card0',
          threads: [
            {
              id: 'l1',
              name: 'Pinned',
              events: [{ id: 'eA', name: 'a', startTime: 100, duration: 100 }],
            },
            {
              id: 'l2',
              name: 'Body',
              events: [{ id: 'eB', name: 'b', startTime: 400, duration: 100 }],
            },
          ],
        },
      ],
    };
    const view = { startTime: 0, endTime: 1000, scrollY: 0 };
    const pinnedModel = {
      minTime: 0,
      maxTime: 1000,
      skipCardHeaders: true as const,
      processes: [
        {
          id: 'pinned',
          name: '',
          threads: [
            {
              id: 'l1',
              name: 'Pinned',
              events: [{ id: 'eA', name: 'a', startTime: 100, duration: 100 }],
            },
          ],
        },
      ],
    };
    const shared = createAltMeasureShared();
    const findEvent = (id: string) => {
      for (const t of model.processes[0]!.threads) {
        const ev = t.events.find((e) => e.id === id);
        if (ev) return ev;
      }
      return null;
    };
    const provide = {
      [ALT_MEASURE_SHARED_KEY as symbol]: shared,
      [ALT_MEASURE_FIND_EVENT_KEY as symbol]: findEvent,
    };
    const nullProps = {
      selectedEventId: null,
      hoveredEventId: null,
      searchQuery: '',
      measureMode: false,
      measureRange: null,
      preferRenderer: 'canvas' as const,
      view,
    };

    async function sizeAndRefresh(wrapper: ReturnType<typeof mount>, modelProp: unknown) {
      const wrap = wrapper.find('[data-testid="swimlane"]').element as HTMLElement;
      Object.defineProperty(wrap, 'clientWidth', { value: 400, configurable: true });
      Object.defineProperty(wrap, 'clientHeight', { value: 120, configurable: true });
      Object.defineProperty(wrap, 'getBoundingClientRect', {
        value: () => ({ left: 0, top: 0, width: 400, height: 120, right: 400, bottom: 120 }),
      });
      const canvas = wrapper.find('[data-testid="swimlane-canvas"]').element as HTMLCanvasElement;
      Object.defineProperty(canvas, 'getBoundingClientRect', {
        value: () => ({ left: 0, top: 0, width: 400, height: 120, right: 400, bottom: 120 }),
      });
      await wrapper.setProps({ model: modelProp as never });
      await nextTick();
      for (const ro of roHandles) ro.fire();
      await nextTick();
    }

    const strip = mount(SwimlaneCanvas, {
      props: {
        ...nullProps,
        model: pinnedModel,
        altMeasureRole: 'strip',
        pinnedLaneIds: ['l1'],
      },
      global: { provide },
      attachTo: document.body,
    });
    const body = mount(SwimlaneCanvas, {
      props: {
        ...nullProps,
        model,
        altMeasureRole: 'body',
        pinnedLaneIds: ['l1'],
      },
      global: { provide },
      attachTo: document.body,
    });
    await sizeAndRefresh(strip, { ...pinnedModel });
    await sizeAndRefresh(body, { ...model });

    // Anchor on strip; free-cursor target captured on body.
    shared.anchorId = 'eA';
    shared.anchorSurface = 'strip';
    shared.target = { eventId: null, time: 500, surface: 'body' };
    shared.pinned = false;
    shared.altKeyHeld = true;
    await nextTick();

    expect(strip.find('[data-testid="alt-measure-cursor-line"]').exists()).toBe(true);
    expect(body.find('[data-testid="alt-measure-cursor-line"]').exists()).toBe(true);
    expect(strip.find('[data-testid="measure-label"]').text()).toBe('300 ns');
    expect(strip.find('[data-testid="alt-measure-stick-anchor"]').exists()).toBe(true);
    expect(body.find('[data-testid="measure-label"]').exists()).toBe(false);
    expect(body.find('[data-testid="alt-measure-stick-anchor"]').exists()).toBe(false);

    strip.unmount();
    body.unmount();
    vi.unstubAllGlobals();
  });

  it('PR-SWIMVIEW-023: collapse or pin-set change clears Alt-measure session', async () => {
    const { nextTick } = await import('vue');
    const model = {
      minTime: 0,
      maxTime: 1000,
      processes: [
        {
          id: 'card0',
          name: 'Card0',
          threads: [
            {
              id: 'l1',
              name: 'Pinned',
              events: [{ id: 'eA', name: 'a', startTime: 100, duration: 100 }],
            },
            {
              id: 'l2',
              name: 'Body',
              events: [{ id: 'eB', name: 'b', startTime: 400, duration: 100 }],
            },
          ],
        },
      ],
    };
    const view = createViewState(model);
    const wrapper = mount(SwimlaneView, {
      props: {
        groups: [
          {
            id: 'card0',
            name: 'Card0',
            lanes: [
              { id: 'l1', name: 'Pinned', color: '#f00', utilization: 0.5 },
              { id: 'l2', name: 'Body', color: '#0f0', utilization: 0.5 },
            ],
          },
        ],
        collapsedIds: [],
        pinnedLaneIds: ['l1'],
        model,
        pinSourceModel: model,
        view,
        selectedEventId: null,
        hoveredEventId: null,
        searchQuery: '',
        preferRenderer: 'canvas' as const,
      },
      attachTo: document.body,
    });

    const shared = (
      wrapper.vm as unknown as {
        altMeasureShared: {
          anchorId: string | null;
          anchorSurface: 'strip' | 'body' | 'solo' | null;
          target: { eventId: string; time: number; surface: 'strip' | 'body' | 'solo' } | null;
          pinned: boolean;
          altKeyHeld: boolean;
        };
      }
    ).altMeasureShared;
    shared.anchorId = 'eA';
    shared.anchorSurface = 'strip';
    shared.target = { eventId: 'eB', time: 400, surface: 'body' };
    shared.pinned = true;
    shared.altKeyHeld = false;
    await nextTick();
    expect(shared.anchorId).toBe('eA');

    await wrapper.setProps({ collapsedIds: ['card0'] });
    await nextTick();
    expect(shared.anchorId).toBeNull();
    expect(shared.target).toBeNull();
    expect(shared.pinned).toBe(false);

    shared.anchorId = 'eA';
    shared.anchorSurface = 'strip';
    shared.target = { eventId: 'eB', time: 400, surface: 'body' };
    shared.pinned = true;
    await nextTick();

    await wrapper.setProps({ pinnedLaneIds: [] });
    await nextTick();
    expect(shared.anchorId).toBeNull();
    expect(shared.target).toBeNull();
    expect(shared.pinned).toBe(false);

    wrapper.unmount();
  });

  it('PR-SWIMVIEW-019: pinned strip stays when ancestor Card is collapsed', () => {
    const fullModel = {
      minTime: 0,
      maxTime: 1000,
      processes: [
        {
          id: 'card0',
          name: 'Card0',
          threads: [
            {
              id: 'l1',
              name: 'Lane',
              events: [{ id: 'e1', name: 'op', startTime: 0, duration: 10 }],
            },
          ],
        },
      ],
    };
    const view = createViewState({
      minTime: 0,
      maxTime: 1000,
      processes: [],
    });
    const wrapper = mount(SwimlaneView, {
      props: {
        groups: [
          {
            id: 'card0',
            name: 'Card0',
            lanes: [{ id: 'l1', name: 'Lane', color: '#f00', utilization: 0.5 }],
          },
        ],
        collapsedIds: ['card0'],
        pinnedLaneIds: ['l1'],
        model: {
          minTime: 0,
          maxTime: 1000,
          processes: [{ id: 'card0', name: 'Card0', threads: [] }],
        },
        pinSourceModel: fullModel,
        view,
        selectedEventId: null,
        hoveredEventId: null,
        searchQuery: '',
      },
    });
    expect(wrapper.find('[data-testid="pinned-strip"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="pinned-canvas"]').exists()).toBe(true);
    expect(wrapper.get('[data-testid="pinned-gutter"]').find('[data-testid="gutter-lane-l1"]').exists()).toBe(
      true,
    );
    // Collapsed Card spacer only in body — no original leaf row.
    expect(wrapper.get('.pr-swim-row--body').find('[data-testid="gutter-lane-l1"]').exists()).toBe(false);
  });
});
