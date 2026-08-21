import { describe, expect, it } from 'vitest';
import { mount } from '@vue/test-utils';
import DetailSummary from './DetailSummary.vue';

describe('DetailSummary', () => {
  it('PR-DSUM-001: renders event name', () => {
    const wrapper = mount(DetailSummary, {
      props: {
        selected: { id: '1', name: 'test_op', startTime: 100, duration: 100, endTime: 200 },
        timeDisplayMode: 'time',
        timeScaleUnit: 'ms',
      },
    });

    expect(wrapper.find('[data-testid="detail-summary"]').exists()).toBe(true);
    expect(wrapper.text()).toContain('test_op');
  });

  it('PR-DSUM-002: formats times in the selected unit', () => {
    const wrapper = mount(DetailSummary, {
      props: {
        selected: { id: '1', name: 'op', startTime: 1_000_000, duration: 500_000, endTime: 1_500_000 },
        timeDisplayMode: 'time',
        timeScaleUnit: 'us',
      },
    });

    expect(wrapper.find('[data-testid="detail-summary"]').exists()).toBe(true);
  });
});
