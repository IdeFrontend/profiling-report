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
    const { readFileSync } = await import('node:fs');
    const { resolve } = await import('node:path');
    const src = readFileSync(resolve(__dirname, '../../tokens.css'), 'utf8');
    const rule = src.match(/\.pr-field-match\s*\{([^}]*)\}/)?.[1] ?? '';
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
    await wrapper.setProps({ activeId: 'ArithmeticUtilization' });
    expect(wrapper.get('[data-testid="summary-search"]').element).toHaveProperty('value', 'mte2');
    expect(wrapper.find('[data-testid="summary-category-fields"]').findAll('li')).toHaveLength(0);
  });

  it('PR-SUMM-004: baseline categories paint delta badges right of the values', () => {
    const cats = [
      {
        id: 'PipeUtilization',
        title: 'PipeUtilization',
        fields: [
          { key: 'aiv_vec_ratio', value: '0.5' },
          { key: 'aic_mte2_ratio', value: '0.8' },
          { key: 'note', value: 'text-only' },
          { key: 'same', value: '0.4' },
        ],
      },
    ];
    const baseline = [
      {
        id: 'PipeUtilization',
        title: 'PipeUtilization',
        fields: [
          { key: 'aiv_vec_ratio', value: '0.7' },
          { key: 'aic_mte2_ratio', value: '0.6' },
          { key: 'note', value: 'text-only' },
          { key: 'same', value: '0.4' },
        ],
      },
    ];
    const wrapper = mount(SummaryCategoryList, {
      props: { categories: cats, baselineCategories: baseline },
    });
    // 0.7 − 0.5 = 0.2 → green down badge right of the value.
    const up = wrapper.get('[data-testid="summary-field-diff-aiv_vec_ratio"]');
    expect(up.classes()).toContain('pr-diff--decrease');
    expect(up.get('.pr-diff__text').text()).toBe('0.2');
    // The badge shares the value's flex line wrapper and follows it in DOM
    // order — the same line, never wrapped under the first one.
    const field = up.element.closest('.pr-summ__field') as HTMLElement;
    const side = field.querySelector('.pr-summ__field-side') as HTMLElement;
    expect(side.contains(field.querySelector('.pr-summ__field-value')!)).toBe(true);
    expect(side.contains(up.element)).toBe(true);
    expect(
      (side.querySelector('.pr-summ__field-value') as HTMLElement).nextElementSibling,
    ).toBe(up.element);
    // 0.6 − 0.8 = −0.2 → red up badge.
    const down = wrapper.get('[data-testid="summary-field-diff-aic_mte2_ratio"]');
    expect(down.classes()).toContain('pr-diff--increase');
    expect(down.get('.pr-diff__text').text()).toBe('0.2');
    // Non-numeric and equal fields carry no badge.
    expect(wrapper.find('[data-testid="summary-field-diff-note"]').exists()).toBe(false);
    expect(wrapper.find('[data-testid="summary-field-diff-same"]').exists()).toBe(false);
    wrapper.unmount();

    // Without a baseline pack: no badges at all.
    const plain = mount(SummaryCategoryList, { props: { categories: cats } });
    expect(plain.findAll('[data-testid^="summary-field-diff-"]')).toHaveLength(0);
    plain.unmount();
  });
});
