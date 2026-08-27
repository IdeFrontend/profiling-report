import { describe, expect, it } from 'vitest';
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
    expect(src).toMatch(/\.pr-gutter-resize\s*\{[^}]*grid-column:\s*1/s);
    expect(src).toMatch(/\.pr-gutter-resize\s*\{[^}]*right:\s*0/s);
    expect(src).not.toMatch(/\.pr-gutter-resize\s*\{[^}]*left:\s*var\(--pr-gutter-width/s);
  });

  it.todo('PR-SWIMVIEW-010: pinned lanes render in a sticky strip above the scroll body');
  it.todo('PR-SWIMVIEW-011: pinned duplicates keep the same lane ids as originals');
  it.todo('PR-SWIMVIEW-012: unpinned originals remain in tree order below the pinned strip');
  it.todo('PR-SWIMVIEW-013: pinned strip canvas omits dependency link rendering');
  it.todo('PR-SWIMVIEW-014: pinnedLaneIds may span multiple Cards; strip follows pin order');
});
