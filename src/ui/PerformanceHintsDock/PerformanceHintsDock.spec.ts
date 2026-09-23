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
  it('PR-PHINTS-001: three columns in sketch order on one 50/25/25 split', async () => {
    const wrapper = mount(PerformanceHintsDock, { props: { rows } });
    expect(wrapper.text()).toContain('性能分析');
    expect(
      wrapper.findAll('[role="columnheader"]').map((th) => th.text()),
    ).toEqual(['Hint Message', 'Source Line', 'Instruction Address']);
    expect(wrapper.findAll('.pr-hints-table__row')).toHaveLength(2);

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

    // Header and body share the flex bases (identical selectors), or the columns drift.
    const src = (await import('./PerformanceHintsDock.vue?raw')).default as string;
    expect(src).toMatch(
      /\.pr-hints-table__msg-col,\s*\.pr-hints-table__msg\s*\{[^}]*flex:\s*0 0 50%/s,
    );
    expect(src).toMatch(
      /\.pr-hints-table__line-col,\s*\.pr-hints-table__line\s*\{[^}]*flex:\s*0 0 25%/s,
    );
    expect(src).toMatch(
      /\.pr-hints-table__pc-col,\s*\.pr-hints-table__pc\s*\{[^}]*flex:\s*0 0 25%/s,
    );
  });

  it('PR-PHINTS-002: source-line cells render the raw id, or the notSpecified copy', () => {
    const withLine: PerformanceHintItem[] = [
      {
        message: 'Hint',
        typeName: 'branch_divergence_hint',
        sourceLineId: '39',
        origin: 'sourceLine',
      },
      { message: 'Kernel hint', typeName: 'mix_gm_hint', origin: 'kernel' },
    ];
    const wrapper = mount(PerformanceHintsDock, {
      props: { rows: withLine, locale: 'en' },
    });
    const bodyRows = wrapper.findAll('.pr-hints-table__row');
    expect(bodyRows[0]!.findAll('[role="cell"]')[1]!.text()).toBe('39');
    expect(bodyRows[1]!.findAll('[role="cell"]')[1]!.text()).toBe('Not specified');
  });

  it('PR-PHINTS-003: null/absent PC renders the notSpecified copy', () => {
    const withoutPc: PerformanceHintItem[] = [
      { message: 'Kernel hint', typeName: 'mix_gm_hint', origin: 'kernel' },
      // The adapter omits `pc`, but a host payload may hand it over as null.
      { message: 'Null pc', origin: 'instruction', pc: null } as unknown as PerformanceHintItem,
    ];
    const en = mount(PerformanceHintsDock, { props: { rows: withoutPc, locale: 'en' } });
    const cells = en.findAll('.pr-hints-table__row');
    expect(cells[0]!.findAll('[role="cell"]')[2]!.text()).toBe('Not specified');
    expect(cells[1]!.findAll('[role="cell"]')[2]!.text()).toBe('Not specified');

    const zh = mount(PerformanceHintsDock, { props: { rows: withoutPc } });
    expect(zh.find('.pr-hints-table__row').findAll('[role="cell"]')[2]!.text()).toBe('未指定');
  });

  it('PR-PHINTS-004: a decimal PC renders as 0x-hex (lowercase)', () => {
    const wrapper = mount(PerformanceHintsDock, {
      props: { rows, locale: 'en' },
    });
    const instructionCells = wrapper
      .findAll('.pr-hints-table__row')[0]!
      .findAll('[role="cell"]');
    expect(instructionCells[2]!.text()).toBe('0x9154b92f74');
  });

  it('PR-PHINTS-005: a PC BigInt rejects renders the raw value as-is', () => {
    const nonDecimal: PerformanceHintItem[] = [
      {
        message: 'Hex-hosted hint',
        typeName: 'branch_divergence_hint',
        origin: 'instruction',
        pc: '9154b92f74abc',
      },
      {
        message: 'Malformed hint',
        typeName: 'mix_gm_hint',
        origin: 'instruction',
        pc: 'N/A',
      },
    ];
    const wrapper = mount(PerformanceHintsDock, {
      props: { rows: nonDecimal, locale: 'en' },
    });
    const bodyRows = wrapper.findAll('.pr-hints-table__row');
    // Raw, not blanked and not the "Not specified" fallback.
    expect(bodyRows[0]!.findAll('[role="cell"]')[2]!.text()).toBe('9154b92f74abc');
    expect(bodyRows[1]!.findAll('[role="cell"]')[2]!.text()).toBe('N/A');
    expect(wrapper.findAll('.pr-hints-table__row')).toHaveLength(2);
  });

  it('PR-PHINTS-006: close button emits close', async () => {
    const wrapper = mount(PerformanceHintsDock, { props: { rows } });
    await wrapper
      .find('[data-testid="performance-hints-close"]')
      .trigger('click');
    expect(wrapper.emitted('close')).toHaveLength(1);
  });

  it('PR-PHINTS-007: the host footer applies the Figma hints chrome', async () => {
    // The shell belongs to the root's dock footer, not this component: the modifier is
    // set from the same computed that gates the pane (ProfilingReport.vue).
    const dockSrc = (await import('../ProfilingReport/ProfilingReport.vue?raw')).default as string;
    const rule = /\.pr-dock--hints\s*\{([^}]*)\}/s.exec(dockSrc);
    expect(rule).not.toBeNull();
    const body = rule![1]!;
    expect(body).toMatch(/height:\s*min\(353px,\s*60vh\)/);
    expect(body).toMatch(/border:\s*1px solid rgba\(255,\s*255,\s*255,\s*0\.1\)/);
    expect(body).toMatch(/border-radius:\s*12px/);
    expect(body).toMatch(/background:\s*rgba\(31,\s*31,\s*31,\s*1\)/);
  });
});
