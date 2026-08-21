import { describe, expect, it } from 'vitest';
import { mount } from '@vue/test-utils';
import DetailPanel from './DetailPanel.vue';

describe('DetailPanel', () => {
  it('PR-DPANEL-001: renders shell with summary', () => {
    const wrapper = mount(DetailPanel, {
      props: {
        selected: { id: '1', name: 'test_op', startTime: 100, duration: 100, endTime: 200 },
        timeDisplayMode: 'time',
        timeScaleUnit: 'ms',
      },
    });

    expect(wrapper.find('[data-testid="detail-panel"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="detail-summary"]').exists()).toBe(true);
    expect(wrapper.text()).toContain('test_op');
  });
});
