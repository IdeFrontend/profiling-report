import { describe, expect, it } from 'vitest';
import { mount } from '@vue/test-utils';
import CsvFieldListPanel from './CsvFieldListPanel.vue';
import type { CsvTableModel } from '../../../domain/types';

const tables: CsvTableModel[] = [
  {
    fileName: 'PipeUtilization.csv',
    headers: ['block_id', 'aiv_vec_ratio', 'aiv_mte2_ratio'],
    rows: [
      { block_id: '0', aiv_vec_ratio: '0.1', aiv_mte2_ratio: '0.2' },
      { block_id: '1', aiv_vec_ratio: '0.3', aiv_mte2_ratio: 'NA' },
    ],
    blockIds: ['0', '1'],
  },
  {
    fileName: 'ArithmeticUtilization.csv',
    headers: ['block_id', 'aic_cube_ratio'],
    rows: [{ block_id: '0', aic_cube_ratio: 'NA' }],
    blockIds: ['0'],
  },
];

const csvTexts = {
  'PipeUtilization.csv': 'block_id,aiv_vec_ratio\n0,0.1\n',
  'ArithmeticUtilization.csv': 'block_id,aic_cube_ratio\n0,NA\n',
};

describe('CsvFieldListPanel', () => {
  it('PR-CSV-001: renders tabs and switches field list', async () => {
    const wrapper = mount(CsvFieldListPanel, {
      props: { tables, csvTexts },
    });

    expect(wrapper.find('[data-testid="csv-field-list"]').exists()).toBe(true);
    expect(wrapper.text()).toContain('aiv_vec_ratio');
    expect(wrapper.text()).toContain('0.1');

    await wrapper.get('[data-testid="csv-tab-ArithmeticUtilization.csv"]').trigger('click');
    expect(wrapper.text()).toContain('aic_cube_ratio');
    expect(wrapper.text()).toContain('NA');
  });

  it('PR-CSV-002: block switcher filters by block_id', async () => {
    const wrapper = mount(CsvFieldListPanel, {
      props: { tables, csvTexts },
    });

    expect(wrapper.get('[data-testid="csv-block"]').element).toHaveProperty('value', '0');
    await wrapper.get('[data-testid="csv-block"]').setValue('1');
    expect(wrapper.text()).toContain('0.3');
    expect(wrapper.text()).toContain('NA');
  });

  it('PR-CSV-003: search filters and highlights matching labels', async () => {
    const wrapper = mount(CsvFieldListPanel, {
      props: { tables, csvTexts },
    });

    await wrapper.get('[data-testid="csv-search"]').setValue('mte2');
    expect(wrapper.text()).toContain('aiv_mte2_ratio');
    expect(wrapper.text()).not.toContain('aiv_vec_ratio');
    const marks = wrapper.findAll('[data-testid="csv-field-match"]');
    expect(marks).toHaveLength(1);
    expect(marks[0].text()).toBe('mte2');
    const src = (await import('./CsvFieldListPanel.vue?raw')).default as string;
    expect(src).toMatch(/\.pr-csv__field-match[\s\S]*?background:\s*#1d283c/);
    expect(src).toMatch(/\.pr-csv__field-match[\s\S]*?color:\s*#688aec/);
    expect(src).toMatch(/\.pr-csv__field-match[\s\S]*?font-weight:\s*600/);
    expect(src).toMatch(/\.pr-csv__field-match[\s\S]*?padding:\s*0;/);
    expect(src).not.toMatch(/padding:\s*0\s+4px/);
    expect(wrapper.find('[data-testid="csv-search-clear"]').exists()).toBe(true);

    await wrapper.get('[data-testid="csv-search-clear"]').trigger('click');
    expect(wrapper.findAll('[data-testid="csv-field-match"]')).toHaveLength(0);
    expect(wrapper.text()).toContain('aiv_vec_ratio');
  });

  it('PR-CSV-004: 查看全部 emits view-full-csv', async () => {
    const wrapper = mount(CsvFieldListPanel, {
      props: { tables, csvTexts },
    });

    await wrapper.get('[data-testid="csv-view-all"]').trigger('click');
    expect(wrapper.emitted('view-full-csv')?.[0]?.[0]).toEqual({
      fileName: 'PipeUtilization.csv',
      text: csvTexts['PipeUtilization.csv'],
    });
  });

  it('PR-CSV-006: flags hide block and 查看全部', () => {
    const wrapper = mount(CsvFieldListPanel, {
      props: { tables, csvTexts, showBlockSwitcher: false, showViewAll: false },
    });

    expect(wrapper.find('[data-testid="csv-search"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="csv-block"]').exists()).toBe(false);
    expect(wrapper.find('[data-testid="csv-view-all"]').exists()).toBe(false);
  });

  it('PR-CSV-005: tab switch does not emit bound block; field list falls back', async () => {
    const wrapper = mount(CsvFieldListPanel, {
      props: { tables, csvTexts, selectedBlockId: '1' },
    });

    expect(wrapper.text()).toContain('0.3');
    await wrapper.get('[data-testid="csv-tab-ArithmeticUtilization.csv"]').trigger('click');
    expect(wrapper.emitted('update:selectedBlockId')).toBeUndefined();
    expect(wrapper.text()).toContain('aic_cube_ratio');
    expect(wrapper.text()).toContain('NA');
    expect(wrapper.get('[data-testid="csv-block"]').element).toHaveProperty('value', '0');
  });
});
