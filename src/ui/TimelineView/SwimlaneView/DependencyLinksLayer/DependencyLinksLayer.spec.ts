import { describe, expect, it } from 'vitest';
import { mount } from '@vue/test-utils';
import DependencyLinksLayer from './DependencyLinksLayer.vue';

describe('DependencyLinksLayer', () => {
  it('PR-DEPS-003: overlay renders one SVG path per d string', () => {
    const wrapper = mount(DependencyLinksLayer, {
      props: {
        paths: ['M0,0 C10,0 20,10 30,10', 'M30,10 C40,10 50,20 60,20'],
        width: 400,
        height: 120,
      },
    });
    expect(wrapper.find('[data-testid="dependency-links-layer"]').exists()).toBe(true);
    expect(wrapper.findAll('path')).toHaveLength(2);
    wrapper.unmount();
  });
});
