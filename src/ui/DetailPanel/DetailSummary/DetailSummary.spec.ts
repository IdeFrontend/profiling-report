import { describe, expect, it } from 'vitest';
import { mount } from '@vue/test-utils';
import DetailSummary from './DetailSummary.vue';

describe('DetailSummary', () => {
  it('PR-DSUM-001: renders event name', () => {
    const wrapper = mount(DetailSummary, {
      props: {
        selected: { id: '1', name: 'test_op', startTime: 100, duration: 100, endTime: 200 },
        unit: 'ms',
      },
    });

    expect(wrapper.find('[data-testid="detail-summary"]').exists()).toBe(true);
    expect(wrapper.text()).toContain('test_op');
  });

  it('PR-DSUM-002: shows bare values with the unit in the column label', () => {
    const wrapper = mount(DetailSummary, {
      props: {
        selected: { id: '1', name: 'op', startTime: 1_000_000, duration: 500_000, endTime: 1_500_000 },
        unit: 'us',
      },
    });

    expect(wrapper.findAll('.pr-detail-summary__value').map((n) => n.text())).toEqual([
      '1000.000',
      '500.000',
      '1500.000',
    ]);
    expect(wrapper.findAll('.pr-detail-summary__label').map((n) => n.text())).toEqual([
      'Start (µs)',
      'Duration (µs)',
      'End (µs)',
    ]);
  });

  it('PR-DSUM-003: shows the type pill from args, hides it when absent', () => {
    const withType = mount(DetailSummary, {
      props: {
        selected: {
          id: '1',
          name: 'FIX_LOC_TO_DST',
          startTime: 0,
          duration: 10,
          endTime: 10,
          args: { op_type: 'MOV_OUT_TO_L1_MULTI_ND2NZ' },
        },
        unit: 'ns',
      },
    });
    expect(withType.find('[data-testid="detail-summary-kind"]').text()).toBe(
      'MOV_OUT_TO_L1_MULTI_ND2NZ',
    );

    const without = mount(DetailSummary, {
      props: {
        selected: { id: '1', name: 'FIX_LOC_TO_DST', startTime: 0, duration: 10, endTime: 10 },
        unit: 'ns',
      },
    });
    expect(without.find('[data-testid="detail-summary-kind"]').exists()).toBe(false);
  });
});
