import { describe, expect, it } from 'vitest';
import { mount } from '@vue/test-utils';
import DependencyLinksLayer from './DependencyLinksLayer.vue';

describe('DependencyLinksLayer', () => {
  it('PR-DEPS-003: overlay renders one SVG path per d string', () => {
    const wrapper = mount(DependencyLinksLayer, {
      props: {
        links: [
          {
            d: 'M0,0 C10,0 20,10 30,10',
            fromColor: '#007084',
            toColor: '#38702C',
            x0: 0,
            y0: 0,
            x1: 30,
            y1: 10,
          },
          {
            d: 'M30,10 C40,10 50,20 60,20',
            fromColor: '#38702C',
            toColor: '#885C00',
            x0: 30,
            y0: 10,
            x1: 60,
            y1: 20,
          },
        ],
        width: 400,
        height: 120,
      },
    });
    expect(wrapper.find('[data-testid="dependency-links-layer"]').exists()).toBe(true);
    expect(wrapper.findAll('path')).toHaveLength(2);
    wrapper.unmount();
  });

  it('PR-DEPS-004: each curve strokes a pred-to-succ fill gradient', () => {
    const wrapper = mount(DependencyLinksLayer, {
      props: {
        links: [
          {
            d: 'M0,0 C10,0 20,10 30,10',
            fromColor: '#007084',
            toColor: '#38702C',
            x0: 0,
            y0: 0,
            x1: 30,
            y1: 10,
          },
        ],
        width: 400,
        height: 120,
      },
    });
    const grad = wrapper.find('linearGradient');
    expect(grad.attributes('gradientUnits')).toBe('userSpaceOnUse');
    expect(grad.attributes('x1')).toBe('0');
    expect(grad.attributes('y1')).toBe('0');
    expect(grad.attributes('x2')).toBe('30');
    expect(grad.attributes('y2')).toBe('10');
    const stops = wrapper.findAll('stop');
    expect(stops[0]!.attributes('stop-color')).toBe('#007084');
    expect(stops[1]!.attributes('stop-color')).toBe('#38702C');
    expect(wrapper.find('path').attributes('stroke')).toBe('url(#pr-dep-grad-0)');
    wrapper.unmount();
  });
});
