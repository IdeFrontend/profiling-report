import { describe, expect, it } from 'vitest';
import { mount } from '@vue/test-utils';
import { createViewState } from '../../domain/viewState';
import TimelineView from './TimelineView.vue';

describe('TimelineView', () => {
  it('PR-TIMELINE-001: renders overview, axis, and body', () => {
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
  });

  it('PR-TIMELINE-002: measure mode keeps overview and draws axis bars + arrow', () => {
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
    await axis.trigger('pointermove', { clientX: 140, clientY: 10, pointerId: 1 });
    await axis.trigger('pointerup', { clientX: 140, clientY: 10, pointerId: 1 });

    const ranges = wrapper.emitted('update:measure-range');
    expect(ranges?.length).toBeGreaterThan(0);
    const last = ranges![ranges!.length - 1][0] as { startTime: number; endTime: number };
    expect(last.endTime).toBeGreaterThan(last.startTime);
  });

  it('PR-TIMELINE-004: measure arrow sharp miter chevrons, 1px tip gap, shaft meets arms', () => {
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

    const heads = wrapper.findAll('[data-testid="measure-arrow-head"]');
    expect(heads).toHaveLength(2);
    for (const head of heads) {
      const path = head.find('path');
      expect(path.attributes('fill')).toBe('none');
      expect(path.attributes('stroke-width')).toBe('1.5');
      expect(path.attributes('stroke-linejoin')).toBe('miter');
    }

    return import('./TimelineView.vue?raw').then((mod) => {
      const src = mod.default as string;
      expect(src).toMatch(/\.pr-measure-arrow__head--left\s*\{[^}]*left:\s*1px/);
      expect(src).toMatch(/\.pr-measure-arrow__head--right\s*\{[^}]*right:\s*1px/);
      expect(src).toMatch(/\.pr-measure-arrow__shaft\s*\{[^}]*left:\s*4px/);
      expect(src).toMatch(/\.pr-measure-arrow__shaft\s*\{[^}]*height:\s*1\.5px/);
      expect(src).toMatch(/\.pr-measure-arrow\s*\{[^}]*color:\s*rgba\(49,\s*122,\s*247,\s*1\)/);
    });
  });
});
