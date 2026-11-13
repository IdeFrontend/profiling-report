import { afterEach, describe, expect, it } from 'vitest';
import { defineComponent, h, nextTick } from 'vue';
import { DOMWrapper, mount } from '@vue/test-utils';
import OperatorOverview from './OperatorOverview.vue';
import type { ReportOperatorRow } from '../../domain/types';

afterEach(() => {
  document.body.innerHTML = '';
});

const rows: ReportOperatorRow[] = [
  {
    opName: 'gather_2d_custom',
    opType: 'vector',
    demangledName: 'gather_2d_custom<float, int>',
    taskDurationUs: 0.73,
    blockDim: 40,
    gridSize: 85.25,
    blockSize: 32,
  },
  {
    opName: 'demo_linear_tiled',
    opType: 'vector',
    taskDurationUs: 0,
    blockDim: 32,
    gridSize: 90.01,
    blockSize: 32,
  },
];

describe('OperatorOverview', () => {
  it('PR-OVW-001: eight table headers match mock', () => {
    const wrapper = mount(OperatorOverview, { props: { rows, locale: 'zh-CN' } });
    expect(wrapper.findAll('thead th').map((th) => th.text())).toEqual([
      '序号',
      'OpName',
      'Optype',
      'DemangledName',
      'Task Duration',
      'BlockDim',
      'Grid Size',
      'Block Size',
    ]);
  });

  it('PR-OVW-002: one row per operator entry', () => {
    const wrapper = mount(OperatorOverview, { props: { rows } });
    const bodyRows = wrapper.findAll('tbody tr');
    expect(bodyRows).toHaveLength(rows.length);
    expect(bodyRows[0].text()).toContain('gather_2d_custom');
    expect(bodyRows[1].text()).toContain('demo_linear_tiled');
    expect(bodyRows[1].findAll('td')[0].text()).toBe('2');
  });

  it('PR-OVW-003: missing values render empty cells', () => {
    const wrapper = mount(OperatorOverview, { props: { rows } });
    const cells = wrapper.findAll('tbody tr')[1].findAll('td');
    expect(cells[3].text()).toBe('');
    expect(wrapper.text()).not.toContain('undefined');
    expect(wrapper.text()).not.toContain('null');
  });

  it('PR-OVW-004: first row selected by default', () => {
    const wrapper = mount(OperatorOverview, { props: { rows } });
    const bodyRows = wrapper.findAll('tbody tr');
    expect(bodyRows[0].attributes('aria-selected')).toBe('true');
    expect(bodyRows[1].attributes('aria-selected')).toBe('false');
  });

  it('PR-OVW-005: row click moves single highlight', async () => {
    const wrapper = mount(OperatorOverview, { props: { rows } });
    const bodyRows = wrapper.findAll('tbody tr');
    await bodyRows[1].trigger('click');
    expect(bodyRows[0].attributes('aria-selected')).toBe('false');
    expect(bodyRows[1].attributes('aria-selected')).toBe('true');
    expect(wrapper.findAll('[aria-selected="true"]')).toHaveLength(1);
  });

  it('PR-OVW-006: dock shows 低利用率 summary', () => {
    const wrapper = mount(OperatorOverview, { props: { rows, locale: 'zh-CN' } });
    const dock = wrapper.get('[data-testid="operator-overview-dock"]');
    expect(dock.text()).toContain('低利用率');
    expect(dock.text()).toContain('预计本地加速比（示例）: 88.69%');
    expect(dock.text()).toContain('选中算子的优化建议');
  });

  it('PR-OVW-007: 执行优化 button renders enabled', () => {
    const wrapper = mount(OperatorOverview, { props: { rows, locale: 'zh-CN' } });
    const button = wrapper.findAll('button').find((b) => b.text() === '执行优化');
    expect(button).toBeDefined();
    expect(button!.attributes('disabled')).toBeUndefined();
    expect(button!.attributes('aria-disabled')).toBeUndefined();
    const glyph = button!.find('svg');
    expect(glyph.attributes('viewBox')).toBe('0 0 16 16');
    expect(glyph.attributes('fill')).toBe('none');
    expect(glyph.attributes('stroke-linecap')).toBe('round');
    expect(glyph.find('polygon').exists()).toBe(false);
    const paths = glyph.findAll('path');
    expect(paths).toHaveLength(4);
    expect(paths[1].attributes('d')).toBe('M7.6 6.5 H12.3');
    expect(paths[2].attributes('d')).toBe('M9.1 9 H12.3');
  });

  it('PR-OVW-008: banner shows underutilization copy', () => {
    const wrapper = mount(OperatorOverview, { props: { rows, locale: 'zh-CN' } });
    const banner = wrapper.get('[data-testid="operator-overview-banner"]');
    expect(banner.text()).toContain(
      '所有计算流水线均未充分利用。这可能是因为工作负载非常小，或者每个调度器发出的线程束（warp）数量不足。请查看启动统计信息和调度器统计信息部分以获取更多详情。',
    );
  });

  it('PR-OVW-009: Task Duration uses two decimals, dimensions stay as-is', () => {
    const wrapper = mount(OperatorOverview, { props: { rows } });
    const first = wrapper.findAll('tbody tr')[0].findAll('td');
    expect(first[4].text()).toBe('0.73');
    expect(first[5].text()).toBe('40');
    expect(first[6].text()).toBe('85.25');
    expect(first[7].text()).toBe('32');
    const second = wrapper.findAll('tbody tr')[1].findAll('td');
    expect(second[4].text()).toBe('0.00');
  });

  it('PR-OVW-010: table exposes grid roles', () => {
    const wrapper = mount(OperatorOverview, { props: { rows } });
    expect(wrapper.get('table').attributes('role')).toBe('grid');
    expect(wrapper.findAll('tr').every((tr) => tr.attributes('role') === 'row')).toBe(true);
    expect(wrapper.findAll('thead th').every((th) => th.attributes('role') === 'columnheader')).toBe(
      true,
    );
    expect(wrapper.findAll('tbody td').every((td) => td.attributes('role') === 'gridcell')).toBe(
      true,
    );
  });

  it('PR-OVW-011: filter glyph only on OpName and Optype', () => {
    const wrapper = mount(OperatorOverview, { props: { rows } });
    const headers = wrapper.findAll('thead th');
    for (const header of [headers[1], headers[2]]) {
      expect(header.find('[data-testid="filter-icon"]').exists()).toBe(true);
      expect(header.find('[data-testid^="sort-icon"]').exists()).toBe(false);
      expect(header.get('[data-testid="filter-icon"]').classes()).toContain(
        'pr-operator-overview__sort',
      );
      expect(header.get('button > span').text()).toBeTruthy();
    }
    for (const header of headers.slice(3)) {
      expect(header.find('[data-testid^="sort-icon"]').exists()).toBe(true);
      expect(header.find('[data-testid="filter-icon"]').exists()).toBe(false);
      expect(header.get('[data-testid^="sort-icon"]').classes()).toContain(
        'pr-operator-overview__sort',
      );
      expect(header.get('button > span').text()).toBeTruthy();
    }
    expect(headers[0].find('[data-testid="filter-icon"]').exists()).toBe(false);
    expect(headers[0].find('[data-testid^="sort-icon"]').exists()).toBe(false);
  });

  it('PR-OVW-012: sort header cycles asc, desc, none', async () => {
    const sortRows: ReportOperatorRow[] = [...rows, { opName: 'missing_duration', opType: 'vector' }];
    const wrapper = mount(OperatorOverview, { props: { rows: sortRows } });
    const durationHeader = () => wrapper.findAll('thead th')[4];
    const opNames = () => wrapper.findAll('tbody tr').map((tr) => tr.findAll('td')[1].text());

    await durationHeader().find('button').trigger('click');
    expect(durationHeader().attributes('aria-sort')).toBe('ascending');
    expect(opNames()).toEqual(['demo_linear_tiled', 'gather_2d_custom', 'missing_duration']);

    await durationHeader().find('button').trigger('click');
    expect(durationHeader().attributes('aria-sort')).toBe('descending');
    expect(opNames()).toEqual(['gather_2d_custom', 'demo_linear_tiled', 'missing_duration']);

    await durationHeader().find('button').trigger('click');
    expect(durationHeader().attributes('aria-sort')).toBe('none');
    expect(opNames()).toEqual(['gather_2d_custom', 'demo_linear_tiled', 'missing_duration']);
    expect(wrapper.findAll('thead th')[0].attributes('aria-sort')).toBeUndefined();
    expect(wrapper.findAll('thead th')[1].attributes('aria-sort')).toBeUndefined();
  });

  it('PR-OVW-013: filter popover multi-selects distinct values', async () => {
    const wrapper = mount(OperatorOverview, { props: { rows }, attachTo: document.body });
    const filterButton = wrapper.findAll('thead th')[1].find('button');
    expect(filterButton.attributes('aria-haspopup')).toBe('true');
    expect(filterButton.attributes('aria-expanded')).toBe('false');
    await filterButton.trigger('click');
    expect(filterButton.attributes('aria-expanded')).toBe('true');

    const popoverEl = document.body.querySelector('.pr-operator-overview__filter-popover');
    expect(popoverEl?.parentElement).toBe(document.body);
    const popover = new DOMWrapper(popoverEl as HTMLElement);
    const checkboxes = popover.findAll('input[type="checkbox"]');
    expect(checkboxes).toHaveLength(2);
    expect(popover.findAll('.pr-operator-overview__filter-option').map((label) => label.text())).toEqual([
      'demo_linear_tiled',
      'gather_2d_custom',
    ]);

    await checkboxes[1].setValue(true);
    expect(wrapper.findAll('tbody tr')).toHaveLength(1);
    expect(document.body.querySelector('.pr-operator-overview__filter-popover')).not.toBeNull();
    await checkboxes[0].setValue(true);
    expect(wrapper.findAll('tbody tr')).toHaveLength(2);
    expect(wrapper.get('.pr-operator-overview__filter-count').text()).toBe('2');
    expect(document.body.querySelector('.pr-operator-overview__filter-popover')).not.toBeNull();

    const wrap = wrapper.get('.pr-operator-overview__table-wrap').element as HTMLElement;
    wrap.dispatchEvent(new Event('scroll'));
    await nextTick();
    expect(document.body.querySelector('.pr-operator-overview__filter-popover')).not.toBeNull();

    window.dispatchEvent(new Event('scroll'));
    await nextTick();
    expect(document.body.querySelector('.pr-operator-overview__filter-popover')).toBeNull();
    expect(filterButton.attributes('aria-expanded')).toBe('false');

    await filterButton.trigger('click');
    expect(document.body.querySelector('.pr-operator-overview__filter-popover')).not.toBeNull();
    await wrapper.findAll('tbody tr')[0].trigger('click');
    await nextTick();
    expect(document.body.querySelector('.pr-operator-overview__filter-popover')).toBeNull();

    await filterButton.trigger('click');
    expect(document.body.querySelector('.pr-operator-overview__filter-popover')).not.toBeNull();
    await wrapper.findAll('thead th')[3].find('button').trigger('click');
    await nextTick();
    expect(document.body.querySelector('.pr-operator-overview__filter-popover')).toBeNull();
    wrapper.unmount();
  });

  it('PR-OVW-014: clear row resets one column filter', async () => {
    const wrapper = mount(OperatorOverview, { props: { rows } });
    await wrapper.findAll('thead th')[1].find('button').trigger('click');
    const popover = new DOMWrapper(
      document.body.querySelector('.pr-operator-overview__filter-popover') as HTMLElement,
    );
    await popover.findAll('.pr-operator-overview__filter-option input[type="checkbox"]')[1].setValue(true);
    expect(wrapper.findAll('tbody tr')).toHaveLength(1);

    await popover.get('.pr-operator-overview__filter-clear').trigger('click');
    expect(wrapper.findAll('tbody tr')).toHaveLength(2);
    expect(wrapper.find('.pr-operator-overview__filter-count').exists()).toBe(false);
    wrapper.unmount();
  });

  it('PR-OVW-015: MixBlockDim renders only with values', () => {
    const withoutMix = mount(OperatorOverview, { props: { rows } });
    expect(withoutMix.findAll('thead th')).toHaveLength(8);
    expect(withoutMix.text()).not.toContain('MixBlockDim');

    const withMix = mount(OperatorOverview, {
      props: { rows: [{ ...rows[0], mixBlockDim: 4 }, rows[1]] },
    });
    const headers = withMix.findAll('thead th');
    expect(headers).toHaveLength(9);
    expect(headers[6].text()).toBe('MixBlockDim');
    expect(withMix.findAll('tbody tr')[0].findAll('td')[6].text()).toBe('4');
  });

  it('PR-OVW-016: 执行优化 emits optimize with the highlighted op name', async () => {
    const wrapper = mount(OperatorOverview, { props: { rows, locale: 'zh-CN' } });
    const button = wrapper.findAll('button').find((b) => b.text() === '执行优化');
    await button!.trigger('click');
    expect(wrapper.emitted('optimize')).toEqual([[{ opName: 'gather_2d_custom' }]]);

    await wrapper.findAll('tbody tr')[1].trigger('click');
    await button!.trigger('click');
    expect(wrapper.emitted('optimize')?.[1]).toEqual([{ opName: 'demo_linear_tiled' }]);
  });

  it('PR-OVW-017: suggestions link stays disabled and keeps the highlighted row', async () => {
    const wrapper = mount(OperatorOverview, { props: { rows, locale: 'zh-CN' } });
    await wrapper.findAll('tbody tr')[1].trigger('click');
    const link = wrapper.findAll('button').find((b) => b.text() === '选中算子的优化建议');
    expect(link!.attributes('disabled')).toBeDefined();
    await link!.trigger('click');
    expect(wrapper.findAll('[aria-selected="true"]')).toHaveLength(1);
    expect(wrapper.findAll('tbody tr')[1].attributes('aria-selected')).toBe('true');
    expect(wrapper.emitted('optimize')).toBeUndefined();
  });

  it('PR-OVW-018: OpName shows short symbol; DemangledName keeps signature', async () => {
    const signature = 'void gather_2d_custom<float, unsigned int>(float*, unsigned int*)';
    const wrapper = mount(OperatorOverview, {
      props: {
        rows: [{ opName: signature, opType: 'vector', demangledName: signature }],
      },
    });
    const cells = wrapper.findAll('tbody tr')[0].findAll('td');
    expect(cells[1].text()).toBe('gather_2d_custom');
    expect(cells[3].text()).toBe(signature);

    await wrapper.findAll('thead th')[1].find('button').trigger('click');
    const popover = new DOMWrapper(
      document.body.querySelector('.pr-operator-overview__filter-popover') as HTMLElement,
    );
    expect(popover.get('.pr-operator-overview__filter-option').text()).toBe(signature);
    await popover.get('.pr-operator-overview__filter-option input').setValue(true);
    expect(wrapper.findAll('tbody tr')).toHaveLength(1);
    wrapper.unmount();
  });

  it('PR-OVW-019: popover escapes the table scroll container', async () => {
    const wrapper = mount(OperatorOverview, { props: { rows } });
    const wrap = wrapper.get('.pr-operator-overview__table-wrap').element as HTMLElement;
    const expectOutsideWrap = () => {
      const popoverEl = document.body.querySelector('.pr-operator-overview__filter-popover')!;
      expect(popoverEl.parentElement).toBe(document.body);
      expect(wrap.contains(popoverEl)).toBe(false);
      expect(wrap.scrollHeight).toBe(wrap.clientHeight);
    };

    await wrapper.findAll('thead th')[1].find('button').trigger('click');
    expectOutsideWrap();

    const popover = new DOMWrapper(
      document.body.querySelector('.pr-operator-overview__filter-popover') as HTMLElement,
    );
    await popover.findAll('.pr-operator-overview__filter-option input[type="checkbox"]')[1].setValue(true);
    expect(wrapper.findAll('tbody tr')).toHaveLength(1);
    expectOutsideWrap();

    await popover.get('.pr-operator-overview__filter-clear').trigger('click');
    expectOutsideWrap();
    wrapper.unmount();
  });

  it('PR-OVW-020: non-reactive rows still highlight and select', async () => {
    const Host = defineComponent({
      setup: () => () => h(OperatorOverview, { rows, locale: 'zh-CN' }),
    });
    const host = mount(Host, { attachTo: document.body });
    const bodyRows = () => host.findAll('tbody tr');

    expect(bodyRows()[0].attributes('aria-selected')).toBe('true');
    expect(bodyRows()[0].classes()).toContain('pr-operator-overview__row--selected');

    await bodyRows()[1].trigger('click');
    expect(bodyRows()[0].attributes('aria-selected')).toBe('false');
    expect(bodyRows()[1].attributes('aria-selected')).toBe('true');
    expect(bodyRows()[1].classes()).toContain('pr-operator-overview__row--selected');

    await host.findAll('thead th')[4].find('button').trigger('click');
    expect(host.findAll('[aria-selected="true"]')).toHaveLength(1);
    expect(bodyRows()[0].findAll('td')[1].text()).toBe('demo_linear_tiled');
    expect(bodyRows()[0].attributes('aria-selected')).toBe('true');
    host.unmount();
  });

  it('PR-OVW-021: rows change resets filter, sort, popover and selection', async () => {
    const wrapper = mount(OperatorOverview, { props: { rows, locale: 'zh-CN' } });
    await wrapper.findAll('thead th')[2].find('button').trigger('click');
    const popover = new DOMWrapper(
      document.body.querySelector('.pr-operator-overview__filter-popover') as HTMLElement,
    );
    await popover.find('.pr-operator-overview__filter-option input').setValue(true);
    await wrapper.findAll('thead th')[4].find('button').trigger('click');
    expect(wrapper.findAll('thead th')[4].attributes('aria-sort')).toBe('ascending');
    await wrapper.findAll('tbody tr')[1].trigger('click');
    expect(wrapper.findAll('tbody tr')[1].attributes('aria-selected')).toBe('true');

    const nextRows: ReportOperatorRow[] = [rows[0], { ...rows[1], opName: 'other', opType: 'cube' }];
    await wrapper.setProps({ rows: nextRows });

    expect(wrapper.findAll('tbody tr')).toHaveLength(2);
    expect(wrapper.find('.pr-operator-overview__filter-count').exists()).toBe(false);
    expect(wrapper.findAll('thead th')[4].attributes('aria-sort')).toBe('none');
    expect(wrapper.findAll('tbody tr')[0].attributes('aria-selected')).toBe('true');
    expect(wrapper.findAll('tbody tr')[1].attributes('aria-selected')).toBe('false');
    expect(document.body.querySelector('.pr-operator-overview__filter-popover')).toBeNull();
    wrapper.unmount();
  });

  it('PR-OVW-022: column widths total 100% with MixBlockDim', () => {
    const wrapper = mount(OperatorOverview, {
      props: { rows: [{ ...rows[0], mixBlockDim: 4 }, rows[1]] },
    });
    const widths = wrapper.findAll('thead th').map((th) => {
      const style = th.attributes('style') ?? '';
      return Number.parseFloat(style.match(/width:\s*([\d.]+)%/)?.[1] ?? '0');
    });
    expect(widths).toHaveLength(9);
    expect(widths.every((width) => width > 0)).toBe(true);
    expect(widths.reduce((total, width) => total + width, 0)).toBe(100);
  });

  it('PR-OVW-023: filter options keep raw values that shorten alike', async () => {
    const signatures: ReportOperatorRow[] = [
      { opName: 'void Foo<float>(float*)', opType: 'vector' },
      { opName: 'void Foo<int>(int*)', opType: 'cube' },
    ];
    const wrapper = mount(OperatorOverview, { props: { rows: signatures } });
    expect(wrapper.findAll('tbody tr').map((tr) => tr.findAll('td')[1].text())).toEqual([
      'Foo',
      'Foo',
    ]);

    await wrapper.findAll('thead th')[1].find('button').trigger('click');
    const options = [...document.body.querySelectorAll('.pr-operator-overview__filter-option')];
    expect(options.map((option) => option.textContent?.trim())).toEqual([
      'void Foo<float>(float*)',
      'void Foo<int>(int*)',
    ]);
    await new DOMWrapper(options[0] as HTMLElement).find('input').setValue(true);
    expect(wrapper.findAll('tbody tr')).toHaveLength(1);
    expect(wrapper.findAll('tbody tr')[0].findAll('td')[2].text()).toBe('vector');
    wrapper.unmount();
  });

  it('PR-OVW-024: Escape closes only the popover and restores trigger focus', async () => {
    const wrapper = mount(OperatorOverview, { props: { rows }, attachTo: document.body });
    const filterButton = wrapper.findAll('thead th')[1].find('button');
    await filterButton.trigger('click');
    await nextTick();
    const popoverInput = document.body.querySelector(
      '.pr-operator-overview__filter-option input',
    );
    expect(document.activeElement).toBe(popoverInput);

    let windowEscapes = 0;
    const onWindowKeydown = () => {
      windowEscapes += 1;
    };
    window.addEventListener('keydown', onWindowKeydown);
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    await nextTick();
    window.removeEventListener('keydown', onWindowKeydown);

    expect(windowEscapes).toBe(0);
    expect(document.body.querySelector('.pr-operator-overview__filter-popover')).toBeNull();
    expect(document.activeElement).toBe(filterButton.element);
    wrapper.unmount();
  });

  it('PR-OVW-025: funnel controls the popover through aria-controls', async () => {
    const wrapper = mount(OperatorOverview, { props: { rows }, attachTo: document.body });
    const filterButton = wrapper.findAll('thead th')[1].find('button');
    expect(filterButton.attributes('aria-controls')).toBeUndefined();

    await filterButton.trigger('click');
    const popover = document.body.querySelector('.pr-operator-overview__filter-popover');
    expect(popover?.id).toBeTruthy();
    expect(filterButton.attributes('aria-controls')).toBe(popover?.id);
    wrapper.unmount();
  });

  it('PR-OVW-026: empty rows render no dock, banner or numbers', () => {
    const wrapper = mount(OperatorOverview, { props: { rows: [], locale: 'zh-CN' } });
    expect(wrapper.find('[data-testid="operator-overview-dock"]').exists()).toBe(false);
    expect(wrapper.find('[data-testid="operator-overview-banner"]').exists()).toBe(false);
    expect(wrapper.text()).not.toContain('88.69');
    expect(wrapper.text()).not.toContain('低利用率');
    expect(wrapper.findAll('button').some((b) => b.text() === '执行优化')).toBe(false);
  });

  it('PR-OVW-027: popover follows table scroll and clamps to viewport', async () => {
    const wrapper = mount(OperatorOverview, { props: { rows }, attachTo: document.body });
    const filterButton = wrapper.findAll('thead th')[1].find('button');
    let left = 10;
    (filterButton.element as HTMLElement).getBoundingClientRect = () => ({
      left,
      top: 0,
      bottom: 20,
      right: left + 60,
      width: 60,
      height: 20,
      x: left,
      y: 0,
      toJSON: () => ({}),
    } as DOMRect);
    await filterButton.trigger('click');
    const popover = () => document.body.querySelector(
      '.pr-operator-overview__filter-popover',
    ) as HTMLElement;
    expect(popover().style.left).toBe('10px');

    left = 40;
    wrapper.get('.pr-operator-overview__table-wrap').element.dispatchEvent(new Event('scroll'));
    await nextTick();
    expect(popover().style.left).toBe('40px');

    left = 5000;
    window.dispatchEvent(new Event('resize'));
    await nextTick();
    expect(Number.parseFloat(popover().style.left)).toBeLessThanOrEqual(window.innerWidth - 200);
    wrapper.unmount();
  });

  it('PR-OVW-028: dock speedup keeps the sample marker with the value', () => {
    const zh = mount(OperatorOverview, { props: { rows, locale: 'zh-CN' } });
    const zhText = zh.get('[data-testid="operator-overview-dock"]').text();
    expect(zhText).toContain('预计本地加速比（示例）');
    expect(zhText).toContain('88.69%');

    const en = mount(OperatorOverview, { props: { rows, locale: 'en-US' } });
    const enText = en.get('[data-testid="operator-overview-dock"]').text();
    expect(enText).toContain('Estimated local speedup (sample)');
    expect(enText).toContain('88.69%');
  });
});
