import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';
import type { SourceFileModel } from '../../domain/types';
import SourceMetricsTable from './SourceMetricsTable.vue';

function bigAsmFile(n: number): SourceFileModel {
  return {
    id: 'asm',
    path: 'Assembly',
    language: 'sass',
    text: '',
    metricsColumns: [
      { id: 'address', label: 'Address', kind: 'text' },
      { id: 'assembly', label: 'Assembly', kind: 'text' },
      { id: 'executionCount', label: 'Instructions Executed', kind: 'number' },
    ],
    lines: Array.from({ length: n }, (_, i) => ({
      line: i + 1,
      values: {
        address: `00000000 ${(i * 4).toString(16).padStart(8, '0')}`,
        assembly: `INSN_${i}`,
        executionCount: i % 7 === 0 ? i : 0,
      },
    })),
  };
}

describe('SourceMetricsTable virtualization', () => {
  function virtExtentPx(wrapper: ReturnType<typeof mount>, rowH: number, lineCount: number) {
    const pads = wrapper.findAll('.pr-src-metrics__virt-pad');
    const padH = pads.reduce((sum, p) => sum + Number.parseFloat(p.attributes('style')?.match(/height:\s*([\d.]+)px/)?.[1] ?? '0'), 0);
    const rows = wrapper.findAll('tr[data-line]').length;
    return { padH, rows, total: padH + rows * rowH, expected: lineCount * rowH };
  }

  it('PR-SOURCE-028: large listings mount a viewport window, not every row', () => {
    const rowH = 18;
    const n = 5000;
    const wrapper = mount(SourceMetricsTable, {
      props: {
        file: bigAsmFile(n),
        currentLine: null,
        rowHeightCss: rowH,
        showHeader: true,
        showLineNumbers: true,
      },
      attachTo: document.body,
    });
    const rows = wrapper.findAll('tr[data-line]');
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.length).toBeLessThan(500);
    expect(wrapper.find('.pr-src-metrics__virt-pad').exists()).toBe(true);
    const ext = virtExtentPx(wrapper, rowH, n);
    expect(ext.total).toBe(ext.expected);
    wrapper.unmount();
  });

  it('PR-SOURCE-028b: sparse lineCount virtualizes extent without dense metrics rows', () => {
    const rowH = 18;
    const n = 8000;
    const file: SourceFileModel = {
      id: '7',
      path: '/sdk/huge.h',
      text: `${Array.from({ length: n }, () => '').join('\n')}\n`,
      metricsColumns: [
        { id: 'executionCount', label: 'Instructions Executed', kind: 'number' },
      ],
      lines: [
        { line: 3, values: { executionCount: 10 } },
        { line: 7900, values: { executionCount: 2 } },
      ],
      lineCount: n,
    };
    const wrapper = mount(SourceMetricsTable, {
      props: {
        file,
        currentLine: null,
        rowHeightCss: rowH,
        showHeader: false,
        showLineNumbers: false,
      },
      attachTo: document.body,
    });
    expect(wrapper.findAll('tr[data-line]').length).toBeLessThan(200);
    expect(wrapper.find('.pr-src-metrics__virt-pad').exists()).toBe(true);
    const ext = virtExtentPx(wrapper, rowH, n);
    expect(ext.total).toBe(ext.expected);
    wrapper.unmount();
  });

  it('PR-SRC-018: sparse source renders reported lines with blank gap rows, not zero rows', () => {
    const rowH = 18;
    const file: SourceFileModel = {
      id: '1',
      path: '/sdk/kernel.asc',
      text: `${Array.from({ length: 24 }, () => '').join('\n')}\n`,
      metricsColumns: [
        { id: 'executionCount', label: 'Instructions Executed', kind: 'number' },
        { id: 'relTime', label: 'Relative time', kind: 'bar' },
        { id: 'warpOccupancy', label: 'Warp occupancy', kind: 'bar' },
      ],
      lines: [
        { line: 17, values: { executionCount: 3 } },
        { line: 22, values: { executionCount: 0 } },
        { line: 24, values: { executionCount: 5 } },
      ],
      lineCount: 24,
      sparse: true,
    };
    const wrapper = mount(SourceMetricsTable, {
      props: {
        file,
        currentLine: null,
        rowHeightCss: rowH,
        showHeader: false,
        showLineNumbers: true,
      },
      attachTo: document.body,
    });
    const bodyRows = wrapper.findAll('tbody tr').filter((tr) =>
      tr.attributes('data-line') != null || tr.classes().includes('pr-src-metrics__row--gap'),
    );
    expect(bodyRows.map((tr) => tr.attributes('data-line') ?? null)).toEqual([
      '17',
      null,
      null,
      '22',
      null,
      null,
      '24',
    ]);
    // A sparse document is short enough to mount whole — no phantom 1..24 extent.
    expect(wrapper.findAll('.pr-src-metrics__virt-pad')).toHaveLength(0);
    const gaps = wrapper.findAll('.pr-src-metrics__row--gap');
    expect(gaps).toHaveLength(4);
    expect(gaps.map((tr) => tr.text())).toEqual(['', '', '', '']);
    // Skipped ranges stay blank — no hatch bar on Relative time / Warp occupancy.
    expect(wrapper.findAll('.pr-src-metrics__row--gap .pr-src-metrics__bar-track')).toHaveLength(0);
    expect(wrapper.findAll('tr[data-line="17"] .pr-src-metrics__bar-track')).toHaveLength(2);
    wrapper.unmount();

    const marked = mount(SourceMetricsTable, {
      props: {
        file,
        currentLine: 17,
        currentDocRow: 2,
        rowHeightCss: rowH,
        showHeader: false,
        showLineNumbers: true,
      },
    });
    const gapRows = marked.findAll('.pr-src-metrics__row--gap');
    expect(gapRows[0]!.classes()).toContain('pr-src-metrics__row--current');
    expect(marked.find('tr[data-line="17"]').classes()).not.toContain('pr-src-metrics__row--current');
    marked.unmount();
  });
});
