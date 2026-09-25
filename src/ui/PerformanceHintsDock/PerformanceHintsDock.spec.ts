import { describe, expect, it } from 'vitest';
import { mount } from '@vue/test-utils';
import PerformanceHintsDock from './PerformanceHintsDock.vue';
import type { PerformanceHintItem } from '../../domain/types';
import { DOCK_HEIGHT_COLLAPSED, DOCK_HEIGHT_EXPANDED } from '../panelResize';

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

  it('PR-PHINTS-007: the pane reuses the standard event-detail dock chrome', async () => {
    // The shell belongs to the root's dock footer, not this component: the pane is a content
    // branch of the same `.pr-dock` that hosts DetailPanel / MultiSelectSummary, and it has no
    // shell of its own — no `pr-dock--hints` modifier and no Figma hints rule (ProfilingReport.vue).
    const dockSrc = (await import('../ProfilingReport/ProfilingReport.vue?raw')).default as string;
    expect(dockSrc).not.toMatch(/pr-dock--hints/);
    const rule = /\.pr-dock\s*\{([^}]*)\}/s.exec(dockSrc);
    expect(rule).not.toBeNull();
    const body = rule![1]!;
    expect(body).toMatch(/height:\s*min\(var\(--pr-dock-h\),\s*60vh\)/);
    expect(body).toMatch(/background:\s*var\(--pr-bg-panel,\s*#262626\)/);
    expect(body).toMatch(/border-radius:\s*16px 16px 0 0/);
  });

  it('PR-PHINTS-008: the pane carries the centred top-edge expander, collapsed by default', async () => {
    const wrapper = mount(PerformanceHintsDock, { props: { rows } });
    const expander = wrapper.find('[data-testid="performance-hints-expander"]');
    expect(expander.exists()).toBe(true);
    expect(expander.attributes('aria-expanded')).toBe('false');
    expect(expander.attributes('aria-label')).toBe('展开详情');

    // Straddling the dock's top edge needs the pane as the positioning context — without
    // `position: relative` here the button escapes to the shell and the centring is lost.
    const src = (await import('./PerformanceHintsDock.vue?raw')).default as string;
    expect(src).toMatch(/\.pr-hints\s*\{[^}]*position:\s*relative/);
    expect(src).toMatch(/\.pr-hints__expander\s*\{[^}]*position:\s*absolute/);
    expect(src).toMatch(/\.pr-hints__expander\s*\{[^}]*top:\s*0/);
    expect(src).toMatch(/\.pr-hints__expander\s*\{[^}]*left:\s*50%/);
    expect(src).toMatch(/\.pr-hints__expander\s*\{[^}]*transform:\s*translateX\(-50%\)/);

    await expander.trigger('click');
    expect(wrapper.emitted('update:height')?.at(-1)).toEqual([DOCK_HEIGHT_EXPANDED]);
  });

  it('PR-PHINTS-009: an expanded height flips the expander back to the collapsed height', async () => {
    const wrapper = mount(PerformanceHintsDock, {
      props: { rows, height: DOCK_HEIGHT_EXPANDED },
    });
    const expander = wrapper.find('[data-testid="performance-hints-expander"]');
    expect(expander.attributes('aria-expanded')).toBe('true');
    expect(expander.attributes('aria-label')).toBe('收起详情');
    expect(expander.classes()).toContain('pr-hints__expander--expanded');

    await expander.trigger('click');
    expect(wrapper.emitted('update:height')?.at(-1)).toEqual([DOCK_HEIGHT_COLLAPSED]);
  });
});
