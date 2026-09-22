import { describe, expect, it } from 'vitest';
import { mount } from '@vue/test-utils';
import PerformanceHintsDock from './PerformanceHintsDock.vue';
import type { PerformanceHintItem } from '../../domain/types';

const rows: PerformanceHintItem[] = [
  {
    message: 'Low warp occupancy detected (32.5%).',
    typeName: 'warp_occupancy_hint',
    pc: '624191680372',
    origin: 'instruction',
  },
  {
    message: 'Operator performs many small global-memory transactions.',
    typeName: 'mix_gm_hint',
    origin: 'kernel',
  },
];

describe('PerformanceHintsDock', () => {
  it('renders three English columns under the localized 性能分析 head', () => {
    const wrapper = mount(PerformanceHintsDock, { props: { rows } });
    expect(wrapper.text()).toContain('性能分析');
    expect(
      wrapper.findAll('[role="columnheader"]').map((th) => th.text()),
    ).toEqual(['Hint Message', 'Source Line', 'Instruction Address']);
    expect(wrapper.findAll('.pr-hints-table__row')).toHaveLength(2);
  });

  it('instruction rows render the PC as 0x-hex; empty cells show "Not specified"', () => {
    const wrapper = mount(PerformanceHintsDock, {
      props: { rows, locale: 'en' },
    });
    const bodyRows = wrapper.findAll('.pr-hints-table__row');
    const instructionCells = bodyRows[0].findAll('[role="cell"]');
    expect(instructionCells[1].text()).toBe('Not specified');
    expect(instructionCells[2].text()).toBe('0x9154b92f74');

    const kernelCells = bodyRows[1].findAll('[role="cell"]');
    expect(kernelCells[1].text()).toBe('Not specified');
    expect(kernelCells[2].text()).toBe('Not specified');
  });

  it('a row with pc absent shows "Not specified" in the address column', () => {
    const wrapper = mount(PerformanceHintsDock, {
      props: { rows: [rows[1]], locale: 'en' },
    });
    const cells = wrapper.find('.pr-hints-table__row').findAll('[role="cell"]');
    expect(cells[2].text()).toBe('Not specified');
  });

  it('zh-CN locale renders 未指定 for empty line/address cells', () => {
    const wrapper = mount(PerformanceHintsDock, {
      props: { rows: [rows[1]] },
    });
    const cells = wrapper.find('.pr-hints-table__row').findAll('[role="cell"]');
    expect(cells[1].text()).toBe('未指定');
    expect(cells[2].text()).toBe('未指定');
    expect(wrapper.text()).not.toContain('—');
  });

  it('close button emits close', async () => {
    const wrapper = mount(PerformanceHintsDock, { props: { rows } });
    await wrapper
      .find('[data-testid="performance-hints-close"]')
      .trigger('click');
    expect(wrapper.emitted('close')).toHaveLength(1);
  });

  it('renders the sourceLineId verbatim for source-line rows', () => {
    const withLine: PerformanceHintItem[] = [
      {
        message: 'Hint',
        typeName: 'branch_divergence_hint',
        sourceLineId: '39',
        origin: 'sourceLine',
      },
    ];
    const wrapper = mount(PerformanceHintsDock, {
      props: { rows: withLine, locale: 'en' },
    });
    const cells = wrapper.find('.pr-hints-table__row').findAll('[role="cell"]');
    expect(cells[1].text()).toBe('39');
    expect(cells[2].text()).toBe('Not specified');
  });

  it('header and body rows share the same flex column classes', () => {
    const wrapper = mount(PerformanceHintsDock, { props: { rows } });
    const head = wrapper.find('.pr-hints-table__head');
    expect(head.attributes('role')).toBe('row');
    expect(head.find('.pr-hints-table__msg-col').exists()).toBe(true);
    expect(head.find('.pr-hints-table__line-col').exists()).toBe(true);
    expect(head.find('.pr-hints-table__pc-col').exists()).toBe(true);

    const bodyRow = wrapper.find('.pr-hints-table__row');
    expect(bodyRow.attributes('role')).toBe('row');
    expect(bodyRow.find('.pr-hints-table__msg').exists()).toBe(true);
    expect(bodyRow.find('.pr-hints-table__line').exists()).toBe(true);
    expect(bodyRow.find('.pr-hints-table__pc').exists()).toBe(true);
  });
});
