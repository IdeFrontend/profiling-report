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
  it('PR-SOURCE-028: large listings mount a viewport window, not every row', () => {
    const wrapper = mount(SourceMetricsTable, {
      props: {
        file: bigAsmFile(5000),
        currentLine: null,
        rowHeightCss: 18,
        showHeader: true,
        showLineNumbers: true,
      },
      attachTo: document.body,
    });
    const rows = wrapper.findAll('tr[data-line]');
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.length).toBeLessThan(500);
    expect(wrapper.find('.pr-src-metrics__virt-pad').exists()).toBe(true);
    wrapper.unmount();
  });

  it('PR-SOURCE-028b: sparse lineCount virtualizes extent without dense metrics rows', () => {
    const file: SourceFileModel = {
      id: '7',
      path: '/sdk/huge.h',
      text: `${Array.from({ length: 8000 }, () => '').join('\n')}\n`,
      metricsColumns: [
        { id: 'executionCount', label: 'Instructions Executed', kind: 'number' },
      ],
      lines: [
        { line: 3, values: { executionCount: 10 } },
        { line: 7900, values: { executionCount: 2 } },
      ],
      lineCount: 8000,
    };
    const wrapper = mount(SourceMetricsTable, {
      props: {
        file,
        currentLine: null,
        rowHeightCss: 18,
        showHeader: false,
        showLineNumbers: false,
      },
      attachTo: document.body,
    });
    expect(wrapper.findAll('tr[data-line]').length).toBeLessThan(200);
    expect(wrapper.find('.pr-src-metrics__virt-pad').exists()).toBe(true);
    wrapper.unmount();
  });
});
