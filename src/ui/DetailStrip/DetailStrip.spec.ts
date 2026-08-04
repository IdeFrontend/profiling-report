import { describe, expect, it } from 'vitest';
import { mount } from '@vue/test-utils';
import DetailStrip from './DetailStrip.vue';

describe('DetailStrip', () => {
  it('PR-STRIP-001: renders event name', () => {
    const wrapper = mount(DetailStrip, {
      props: {
        selected: { id: '1', name: 'test_op', startTime: 100, duration: 100, endTime: 200 },
        unit: 'ms',
      },
    });

    expect(wrapper.find('[data-testid="detail-strip"]').exists()).toBe(true);
    expect(wrapper.text()).toContain('test_op');
  });
});
