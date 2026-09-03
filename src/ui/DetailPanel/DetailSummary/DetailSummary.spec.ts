import { describe, expect, it } from 'vitest';
import { mount } from '@vue/test-utils';
import DetailSummary from './DetailSummary.vue';

/** One rule's declarations from the raw SFC. Scoped so comment prose — which cites the
 *  dropped declarations on purpose — cannot satisfy or break a negative assertion. */
const rule = (src: string, selector: string): string =>
  src.match(new RegExp(`${selector}\\s*\\{([^}]*)\\}`))?.[1] ?? '';

describe('DetailSummary', () => {
  it('PR-DSUM-001: renders event name', () => {
    const wrapper = mount(DetailSummary, {
      props: {
        selected: { id: '1', name: 'test_op', startTime: 100, duration: 100, endTime: 200 },
      },
    });

    expect(wrapper.find('[data-testid="detail-summary"]').exists()).toBe(true);
    expect(wrapper.text()).toContain('test_op');
  });

  it('PR-DSUM-002: shows bare values with per-value unit in each caption', () => {
    const wrapper = mount(DetailSummary, {
      props: {
        selected: { id: '1', name: 'op', startTime: 1_000_000, duration: 500_000, endTime: 1_500_000 },
      },
    });

    expect(wrapper.findAll('.pr-detail-summary__number').map((n) => n.text())).toEqual([
      '1.000',
      '500.0',
      '1.500',
    ]);
    expect(wrapper.findAll('.pr-detail-summary__unit').map((n) => n.text())).toEqual([
      'ms',
      'µs',
      'ms',
    ]);
    expect(wrapper.findAll('.pr-detail-summary__label').map((n) => n.text())).toEqual([
      'Start',
      'Duration',
      'End',
    ]);
    expect(wrapper.findAll('.pr-detail-summary__value').map((n) => n.attributes('title'))).toEqual([
      '1.000 ms',
      '500.000 µs',
      '1.500 ms',
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
      },
    });
    expect(withType.find('[data-testid="detail-summary-kind"]').text()).toBe(
      'MOV_OUT_TO_L1_MULTI_ND2NZ',
    );

    const without = mount(DetailSummary, {
      props: {
        selected: { id: '1', name: 'FIX_LOC_TO_DST', startTime: 0, duration: 10, endTime: 10 },
      },
    });
    expect(without.find('[data-testid="detail-summary-kind"]').exists()).toBe(false);
  });

  it('PR-DSUM-004: every truncating cell carries its full text on hover', () => {
    // A real Ascend timestamp: the cell shows "708421242..." and the digits are the point.
    const wrapper = mount(DetailSummary, {
      props: {
        selected: {
          id: '1',
          name: '0-0-103-13-2(matmul)',
          startTime: 708_421_242_123_456,
          duration: 41_000,
          endTime: 708_421_242_164_456,
          args: { op_type: 'event' },
        },
      },
    });

    const values = wrapper.findAll('.pr-detail-summary__value');
    expect(wrapper.findAll('.pr-detail-summary__number').map((n) => n.text())).toEqual([
      '708 400',
      '41.00',
      '708 400',
    ]);
    expect(wrapper.findAll('.pr-detail-summary__unit').map((n) => n.text())).toEqual([
      's',
      'µs',
      's',
    ]);
    const titles = values.map((n) => n.attributes('title'));
    expect(titles).toEqual([
      '708 421.242 s',
      '41.000 µs',
      '708 421.242 s',
    ]);
    expect(wrapper.find('.pr-detail-summary__name').attributes('title')).toBe(
      '0-0-103-13-2(matmul)',
    );
    expect(wrapper.find('[data-testid="detail-summary-kind"]').attributes('title')).toBe('event');
  });

  it('PR-DSUM-005: metrics set the card width; only the name and pill crop', async () => {
    // jsdom does no layout, so assert the declarations the sizing rests on. Each is
    // load-bearing and each is a plausible thing to re-add while tidying.
    const src = (await import('./DetailSummary.vue?raw')).default as string;
    const panel = (await import('../DetailPanel.vue?raw')).default as string;

    // Zeroing this collapses the cells and the figures ellipsize again.
    expect(rule(src, '\\.pr-detail-summary__metric')).not.toMatch(/min-width/);
    for (const selector of ['\\.pr-detail-summary__value', '\\.pr-detail-summary__label']) {
      expect(rule(src, selector), selector).not.toMatch(/text-overflow|overflow/);
    }
    // A fixed track would crop the cells however wide they are.
    expect(rule(panel, '\\.pr-detail-panel__body')).toMatch(/grid-template-columns:\s*min-content/);
    expect(rule(panel, '\\.pr-detail-panel__body--no-relevant')).toMatch(
      /grid-template-columns:\s*min-content/,
    );

    // The name is free to be long, so it must still give way.
    expect(rule(src, '\\.pr-detail-summary__name')).toMatch(/text-overflow:\s*ellipsis/);
    expect(rule(src, '\\.pr-detail-summary__kind')).toMatch(/text-overflow:\s*ellipsis/);
  });
});
