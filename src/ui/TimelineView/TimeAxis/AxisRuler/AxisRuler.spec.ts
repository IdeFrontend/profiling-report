import { describe, expect, it } from 'vitest';
import { mount } from '@vue/test-utils';
import {
  AXIS_RULER_MINORS_PER_GAP,
  buildAxisRulerTicks,
  calculateGridInterval,
} from '../../../../domain/axisRuler';
import AxisRuler from './AxisRuler.vue';

describe('PR-AXIS: shared ruler', () => {
  it('PR-AXIS-002: nice majors snap to origin + k·interval; 9 minors per gap; relative zero', () => {
    // span 10_000 ns, width 1000 → timePerPixel=10 → minInterval=1000 → picks 1µs
    const { majors, minors, interval, baseLabel } = buildAxisRulerTicks({
      rangeStart: 986,
      rangeEnd: 986 + 10_000,
      origin: 986,
      timeScaleUnit: 'ms',
      widthPx: 1000,
    });
    expect(interval).toBe(1000);
    expect(baseLabel).toBeNull();
    expect(majors[0]?.t).toBe(986);
    expect(majors[0]?.label).toBe('0ms');
    for (const m of majors) {
      expect((m.t - 986) % interval).toBe(0);
    }
    // 0..10_000 inclusive at 1µs → 11 majors; 10 gaps × 9 minors
    expect(majors).toHaveLength(11);
    expect(minors.length).toBeGreaterThanOrEqual(10 * AXIS_RULER_MINORS_PER_GAP);
  });

  it('PR-AXIS-002b: finer zoom yields a smaller interval', () => {
    const wide = calculateGridInterval(10_000 / 800);
    const tight = calculateGridInterval(500 / 800);
    expect(tight).toBeLessThan(wide);
  });

  it('PR-AXIS-001: renders majors and minors with testids', () => {
    const ticks = buildAxisRulerTicks({
      rangeStart: 0,
      rangeEnd: 10_000,
      origin: 0,
      timeScaleUnit: 'ms',
      widthPx: 1000,
    });
    const wrapper = mount(AxisRuler, {
      props: { majors: ticks.majors, minors: ticks.minors },
    });
    expect(wrapper.find('[data-testid="axis-ruler"]').exists()).toBe(true);
    expect(wrapper.findAll('[data-testid="axis-ruler-major"]').length).toBe(
      ticks.majors.length,
    );
    expect(wrapper.findAll('[data-testid="axis-ruler-minor"]').length).toBe(
      ticks.minors.length,
    );
    expect(wrapper.find('.pr-axis-ruler__label').text()).toBe('0ms');
  });

  it('PR-AXIS-004: renders viewport base in separate column with + separator', () => {
    const wrapper = mount(AxisRuler, {
      props: {
        majors: [{ t: 0, pct: 0, label: '0ns' }],
        minors: [],
        baseLabel: '236 256 145.000 µs',
      },
    });
    expect(wrapper.find('[data-testid="axis-ruler-base"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="axis-ruler-base"]').text()).toBe('236 256 145.000 µs');
    expect(wrapper.find('[data-testid="axis-ruler-track"]').exists()).toBe(true);
    expect(wrapper.find('.pr-axis-ruler__base-sep').text()).toBe('+');
    expect(wrapper.find('[data-testid="axis-ruler-track"] .pr-axis-ruler__label').text()).toBe('0ns');
    expect(wrapper.find('[data-testid="axis-ruler-base"]').element.parentElement).not.toBe(
      wrapper.find('[data-testid="axis-ruler-track"]').element,
    );

    const plain = mount(AxisRuler, {
      props: {
        majors: [{ t: 0, pct: 0, label: '0ms' }],
        minors: [],
      },
    });
    expect(plain.find('[data-testid="axis-ruler-base"]').exists()).toBe(false);
    expect(plain.find('.pr-axis-ruler__base-sep').exists()).toBe(false);
  });

  it('PR-AXIS-003: major/minor bars use --pr-axis-tick; muted use --pr-axis-tick-muted', async () => {
    const src = (await import('./AxisRuler.vue?raw')).default as string;
    expect(src).toMatch(
      /\.pr-axis-ruler__bar\s*\{[^}]*background:\s*var\(--pr-axis-tick,\s*rgb\(52,\s*52,\s*52\)\)/,
    );
    expect(src).toMatch(
      /\.pr-axis-ruler__major--muted\s+\.pr-axis-ruler__bar\s*\{[^}]*background:\s*var\(--pr-axis-tick-muted,\s*rgb\(39,\s*39,\s*39\)\)/,
    );
    expect(src).toMatch(
      /\.pr-axis-ruler__minor\s*\{[^}]*background:\s*var\(--pr-axis-tick,\s*rgb\(52,\s*52,\s*52\)\)/,
    );
    expect(src).toMatch(
      /\.pr-axis-ruler__minor--muted\s*\{[^}]*background:\s*var\(--pr-axis-tick-muted,\s*rgb\(39,\s*39,\s*39\)\)/,
    );
  });
});
