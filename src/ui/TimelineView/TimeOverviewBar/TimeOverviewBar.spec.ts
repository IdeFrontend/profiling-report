import { describe, expect, it } from 'vitest';
import { mount } from '@vue/test-utils';
import TimeOverviewBar from './TimeOverviewBar.vue';

describe('TimeOverviewBar', () => {
  it('PR-OVERVIEW-001: renders timeline bar with window indicator', () => {
    const wrapper = mount(TimeOverviewBar, {
      props: {
        minTime: 0,
        maxTime: 10000,
        startTime: 2000,
        endTime: 8000,
        timeUnit: 'us',
      },
    });

    expect(wrapper.find('[data-testid="time-overview"]').exists()).toBe(true);
  });

  it('PR-OVERVIEW-002: renders window indicator with correct proportional width', () => {
    const wrapper = mount(TimeOverviewBar, {
      props: {
        minTime: 0,
        maxTime: 10000,
        startTime: 3000,
        endTime: 7000,
        timeUnit: 'ms',
      },
    });

    const win = wrapper.find('[data-testid="time-overview-window"]');
    expect(win.exists()).toBe(true);
    const style = win.attributes('style') || '';
    // Window covers 40% of total span (4000 / 10000)
    expect(style).toContain('width');
  });

  it('PR-OVERVIEW-003: leftmost tick shows producer time when minTime ≠ 0', () => {
    const wrapper = mount(TimeOverviewBar, {
      props: {
        minTime: 986,
        maxTime: 5260,
        startTime: 986,
        endTime: 5260,
        timeUnit: 'ms',
      },
    });
    const firstLabel = wrapper.find('.pr-axis-ruler__label');
    expect(firstLabel.text()).toBe('0.0010ms');
  });

  it('PR-OVERVIEW-004: ruler renders majors and minors', () => {
    const wrapper = mount(TimeOverviewBar, {
      props: {
        minTime: 0,
        maxTime: 10000,
        startTime: 0,
        endTime: 10000,
        timeUnit: 'ms',
      },
    });
    expect(wrapper.find('[data-testid="axis-ruler"]').exists()).toBe(true);
    expect(wrapper.findAll('[data-testid="axis-ruler-major"]').length).toBeGreaterThan(0);
    expect(wrapper.findAll('[data-testid="axis-ruler-minor"]').length).toBeGreaterThan(0);
  });

  it('PR-OVERVIEW-005: handle tab 4×10 flush vertically; track allows horizontal uncrop', async () => {
    const src = (await import('./TimeOverviewBar.vue?raw')).default as string;
    expect(src).toMatch(
      /\.pr-overview__handle-tab\s*\{[^}]*top:\s*0[^}]*width:\s*4px[^}]*height:\s*10px/s,
    );
    expect(src).toMatch(/\.pr-overview__handle-stem\s*\{[^}]*top:\s*10px/s);
    expect(src).not.toMatch(/\.pr-overview__handle-tab\s*\{[^}]*top:\s*-\d+px/s);
    expect(src).toMatch(/\.pr-overview__track\s*\{[^}]*overflow:\s*visible/s);
    expect(src).not.toMatch(/\.pr-overview__track\s*\{[^}]*overflow:\s*hidden/s);
  });

  it('PR-OVERVIEW-006: handle drag ends on window pointerup outside the track', async () => {
    const wrapper = mount(TimeOverviewBar, {
      props: {
        minTime: 0,
        maxTime: 1000,
        startTime: 200,
        endTime: 500,
        timeUnit: 'ms',
      },
      attachTo: document.body,
    });
    const track = wrapper.find('[data-testid="time-overview-track"]').element as HTMLElement;
    Object.defineProperty(track, 'getBoundingClientRect', {
      value: () => ({ left: 0, top: 0, width: 400, height: 20, right: 400, bottom: 20 }),
    });

    const right = wrapper.get('[data-testid="time-overview-handle-right"]');
    await right.trigger('pointerdown', { clientX: 200, clientY: 10, button: 0, pointerId: 1 });
    window.dispatchEvent(new PointerEvent('pointermove', { clientX: 280, clientY: 10, buttons: 1 }));
    window.dispatchEvent(new PointerEvent('pointerup', { clientX: 280, clientY: 10 }));

    const updates = wrapper.emitted('update:window');
    expect(updates?.length).toBeGreaterThan(0);
    const countAfterUp = updates!.length;
    window.dispatchEvent(new PointerEvent('pointermove', { clientX: 320, clientY: 10, buttons: 0 }));
    expect(wrapper.emitted('update:window')!.length).toBe(countAfterUp);
    wrapper.unmount();
  });
});
