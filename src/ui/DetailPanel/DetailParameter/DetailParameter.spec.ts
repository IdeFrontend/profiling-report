import { describe, expect, it } from 'vitest';
import { mount } from '@vue/test-utils';
import DetailParameter from './DetailParameter.vue';

describe('DetailParameter', () => {
  it('PR-DPARAM-001: renders Parameter shell', () => {
    const wrapper = mount(DetailParameter);
    expect(wrapper.find('[data-testid="detail-parameter"]').exists()).toBe(true);
    expect(wrapper.text()).toContain('Parameter');
  });
});
