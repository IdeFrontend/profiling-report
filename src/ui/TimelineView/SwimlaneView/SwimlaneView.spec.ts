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
  });

  it('PR-SWIMVIEW-004: swim cursor layer stacks under card strips', async () => {
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

    expect(wrapper.find('[data-testid="swim-cursor-layer"]').exists()).toBe(true);
    const src = (await import('./SwimlaneView.vue?raw')).default as string;
    expect(src).toMatch(/\.pr-card-strips\s*\{[^}]*z-index:\s*8/);
    expect(src).toMatch(/\.pr-swim-cursor-layer\s*\{[^}]*z-index:\s*7/);
    const canvasSrc = (await import('./SwimlaneCanvas/SwimlaneCanvas.vue?raw')).default as string;
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
});
