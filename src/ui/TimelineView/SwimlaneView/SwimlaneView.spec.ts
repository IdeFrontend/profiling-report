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
    const canvasSrc = (await import('./SwimlaneCanvas/SwimlaneCanvas.vue?raw')).default as string;
    expect(canvasSrc).toMatch(/\.pr-swim-cursor\s*\{[^}]*z-index:\s*3/);
    expect(canvasSrc).toMatch(/\.pr-measure-edge-mark\s*\{[^}]*z-index:\s*4/);
    expect(canvasSrc).toMatch(/\.pr-measure-edge-mark--snap\s*\{[^}]*z-index:\s*5/);
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
});
