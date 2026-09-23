import { describe, expect, it } from 'vitest';
import { mount } from '@vue/test-utils';
import SummaryCategoryList from './SummaryCategoryList.vue';
import type { SummaryCategory } from '../../../domain/types';

const categories: SummaryCategory[] = [
  {
    id: 'PipeUtilization',
    title: 'PipeUtilization',
    fields: [
      { key: 'aiv_vec_ratio', value: '0.1' },
      { key: 'aiv_mte2_ratio', value: '0.2' },
    ],
  },
  {
    id: 'ArithmeticUtilization',
    title: 'ArithmeticUtilization',
    fields: [{ key: 'aic_cube_ratio', value: 'NA' }],
  },
];

describe('SummaryCategoryList', () => {
  it('PR-SUMM-001: renders tabs and switches field list', async () => {
    const wrapper = mount(SummaryCategoryList, {
      props: { categories },
    });

    expect(wrapper.find('[data-testid="summary-category-list"]').exists()).toBe(true);
    expect(wrapper.text()).toContain('aiv_vec_ratio');
    expect(wrapper.text()).toContain('0.1');

    await wrapper.get('[data-testid="summary-category-tab-ArithmeticUtilization"]').trigger('click');
    expect(wrapper.emitted('update:activeId')?.[0]?.[0]).toBe('ArithmeticUtilization');
    await wrapper.setProps({ activeId: 'ArithmeticUtilization' });
    expect(wrapper.text()).toContain('aic_cube_ratio');
    expect(wrapper.text()).not.toContain('aiv_vec_ratio');
  });

  it('PR-SUMM-002: search filters and highlights matching keys', async () => {
    const wrapper = mount(SummaryCategoryList, {
      props: { categories, activeId: 'PipeUtilization' },
    });

    expect(wrapper.find('[data-testid="summary-search"]').exists()).toBe(true);
    await wrapper.get('[data-testid="summary-search"]').setValue('mte2');
    expect(wrapper.text()).toContain('aiv_mte2_ratio');
    expect(wrapper.text()).not.toContain('aiv_vec_ratio');
    const marks = wrapper.findAll('[data-testid="summary-field-match"]');
    expect(marks).toHaveLength(1);
    expect(marks[0].text()).toBe('mte2');
    const src = (await import('./SummaryCategoryList.vue?raw')).default as string;
    const rule = src.match(/\.pr-summ__field-match\s*\{([^}]*)\}/)?.[1] ?? '';
    expect(rule).toMatch(/background:\s*#1d283c/);
    expect(rule).toMatch(/color:\s*#688aec/);
    expect(rule).toMatch(/font-weight:\s*600/);
    expect(rule).toMatch(/padding:\s*0;/);
    expect(wrapper.find('[data-testid="summary-search-clear"]').exists()).toBe(true);

    await wrapper.get('[data-testid="summary-search-clear"]').trigger('click');
    expect(wrapper.findAll('[data-testid="summary-field-match"]')).toHaveLength(0);
    expect(wrapper.text()).toContain('aiv_vec_ratio');
  });

  it('PR-SUMM-003: zero matches leave an empty list; query survives tab switch', async () => {
    const wrapper = mount(SummaryCategoryList, {
      props: { categories, activeId: 'PipeUtilization' },
    });

    await wrapper.get('[data-testid="summary-search"]').setValue('zzzz');
    expect(wrapper.find('[data-testid="summary-category-fields"]').findAll('li')).toHaveLength(0);

    await wrapper.get('[data-testid="summary-search"]').setValue('mte2');
    await wrapper.get('[data-testid="summary-category-tab-ArithmeticUtilization"]').trigger('click');
    expect(wrapper.get('[data-testid="summary-search"]').element).toHaveProperty('value', 'mte2');
  });
});
