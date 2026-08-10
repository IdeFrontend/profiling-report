import { describe, expect, it } from 'vitest';
import { mount } from '@vue/test-utils';
import DetailRelevant from './DetailRelevant.vue';

describe('DetailRelevant', () => {
  it('PR-DREL-001: renders Relevant shell', () => {
    const wrapper = mount(DetailRelevant);
    expect(wrapper.find('[data-testid="detail-relevant"]').exists()).toBe(true);
    expect(wrapper.text()).toContain('Relevant');
  });
});
