import { describe, expect, it } from 'vitest';
import { mount } from '@vue/test-utils';
import ReportToolbar from './ReportToolbar.vue';

describe('ReportToolbar', () => {
  const defaultProps = {
    searchQuery: '',
    asideVisible: false,
    asideAvailable: true,
    zoomPercent: 100,
    timeUnit: 'ms',
  } as const;

  it('PR-TOOLBAR-001: emits update:searchQuery on text input', async () => {
    const wrapper = mount(ReportToolbar, { props: defaultProps });
    const input = wrapper.find('[data-testid="search-input"]');
    await input.setValue('test query');
    expect(wrapper.emitted('update:searchQuery')).toEqual([['test query']]);
  });

  it('PR-TOOLBAR-002: emits zoom-in on button click', async () => {
    const wrapper = mount(ReportToolbar, { props: defaultProps });
    await wrapper.find('[data-testid="zoom-in"]').trigger('click');
    expect(wrapper.emitted('zoom-in')).toBeTruthy();
  });

  it('PR-TOOLBAR-003: emits zoom-out on button click', async () => {
    const wrapper = mount(ReportToolbar, { props: defaultProps });
    await wrapper.find('[data-testid="zoom-out"]').trigger('click');
    expect(wrapper.emitted('zoom-out')).toBeTruthy();
  });

  it('PR-TOOLBAR-004: emits zoom-to-fit on button click', async () => {
    const wrapper = mount(ReportToolbar, { props: defaultProps });
    await wrapper.find('[data-testid="zoom-to-fit"]').trigger('click');
    expect(wrapper.emitted('zoom-to-fit')).toBeTruthy();
  });

  it('PR-TOOLBAR-005: layers opens display control; unit select emits update:timeUnit', async () => {
    const wrapper = mount(ReportToolbar, { props: defaultProps });
    expect(wrapper.find('[data-testid="time-unit"]').exists()).toBe(false);
    expect(wrapper.find('[data-testid="display-control"]').exists()).toBe(false);

    await wrapper.find('[data-testid="toggle-display-control"]').trigger('click');
    expect(wrapper.find('[data-testid="display-control"]').exists()).toBe(true);
    const select = wrapper.find('[data-testid="time-unit"]');
    expect(select.exists()).toBe(true);
    await select.setValue('us');
    expect(wrapper.emitted('update:timeUnit')).toEqual([['us']]);
    expect(wrapper.find('[data-testid="display-control"]').exists()).toBe(true);
  });

  it('PR-TOOLBAR-006: emits update:asideVisible when aside toggle is clicked', async () => {
    const wrapper = mount(ReportToolbar, { props: { ...defaultProps, asideAvailable: true } });
    await wrapper.find('[data-testid="toggle-aside"]').trigger('click');
    expect(wrapper.emitted('update:asideVisible')).toEqual([[true]]);
  });

  it('PR-TOOLBAR-007: measure toggle is temporarily hidden', () => {
    const wrapper = mount(ReportToolbar, { props: { ...defaultProps, measureMode: false } });
    expect(wrapper.find('[data-testid="toggle-measure"]').exists()).toBe(false);
  });

  it('PR-TOOLBAR-008: search magnifier SVG and zoom compound pill chrome', () => {
    const wrapper = mount(ReportToolbar, { props: defaultProps });
    expect(wrapper.find('[data-testid="search-magnifier"]').exists()).toBe(true);
    expect(wrapper.find('.pr-toolbar__zoom-pill').exists()).toBe(true);
    expect(wrapper.find('[data-testid="zoom-out"] svg').exists()).toBe(true);
    expect(wrapper.find('[data-testid="zoom-in"] svg').exists()).toBe(true);
    expect(wrapper.find('[data-testid="zoom-to-fit"] svg').exists()).toBe(true);
  });

  it('PR-TOOLBAR-009: strip/search/zoom surface colors match sketch tokens', async () => {
    const src = (await import('./ReportToolbar.vue?raw')).default as string;
    expect(src).toMatch(/\.pr-chrome[\s\S]*?background:\s*var\(--pr-bg-deep/);
    expect(src).toMatch(/\.pr-toolbar__search input[\s\S]*?background:\s*#2a2a2a/);
    expect(src).toMatch(/\.pr-toolbar__zoom-pill[\s\S]*?background:\s*#363636/);
    expect(src).toMatch(/#ffffff\s+0%/); // filled track
    expect(src).toMatch(/#1a1a1a\s+var\(--pr-zoom-fill/); // unfilled webkit
    expect(src).toMatch(/::-moz-range-track[\s\S]*?background:\s*#1a1a1a/);
    expect(src).toMatch(/::-moz-range-progress[\s\S]*?background:\s*#ffffff/);
  });

  it('PR-TOOLBAR-009b: display-control popover uses sketch surface tokens', async () => {
    const src = (await import('./ReportToolbar.vue?raw')).default as string;
    expect(src).toMatch(/\.pr-toolbar__display-control[\s\S]*?background:\s*#363636/);
    expect(src).toMatch(/\.pr-toolbar__display-control[\s\S]*?border-radius:\s*12px/);
    expect(src).toMatch(/\.pr-toolbar__display-control[\s\S]*?border:\s*1px solid #5e5e5e/);
    expect(src).toMatch(/\.pr-toolbar__display-field select[\s\S]*?background-color:\s*#404040/);
    expect(src).toMatch(/\.pr-toolbar__display-field select[\s\S]*?border-radius:\s*6px/);
  });

  it('PR-TOOLBAR-009c: action icon rest/hover/pressed match sketch', async () => {
    const src = (await import('./ReportToolbar.vue?raw')).default as string;
    expect(src).toMatch(/\.pr-toolbar__icon-btn\s*\{[^}]*background:\s*#363636/);
    expect(src).toMatch(/\.pr-toolbar__icon-btn\s*\{[^}]*color:\s*#b3b3b3/);
    expect(src).toMatch(/\.pr-toolbar__icon-btn\s*\{[^}]*border-radius:\s*6px/);
    expect(src).toMatch(/\.pr-toolbar__icon-btn:hover[\s\S]*?background:\s*#1e2a3e/);
    expect(src).toMatch(/\.pr-toolbar__icon-btn:hover[\s\S]*?color:\s*#2d70e3/);
  });

  it('PR-TOOLBAR-010: display control closes via X or layers toggle', async () => {
    const wrapper = mount(ReportToolbar, { props: defaultProps });
    const btn = wrapper.find('[data-testid="toggle-display-control"]');
    await btn.trigger('click');
    expect(wrapper.find('[data-testid="display-control"]').exists()).toBe(true);

    await wrapper.find('[data-testid="display-control-close"]').trigger('click');
    expect(wrapper.find('[data-testid="display-control"]').exists()).toBe(false);

    await btn.trigger('click');
    expect(wrapper.find('[data-testid="display-control"]').exists()).toBe(true);
    await btn.trigger('click');
    expect(wrapper.find('[data-testid="display-control"]').exists()).toBe(false);
  });

  it('PR-TOOLBAR-011: dependency-mode select emits update:dependencyMode; popover stays open', async () => {
    const wrapper = mount(ReportToolbar, { props: defaultProps });
    await wrapper.find('[data-testid="toggle-display-control"]').trigger('click');
    const select = wrapper.find('[data-testid="dependency-mode"]');
    expect(select.exists()).toBe(true);
    await select.setValue('predecessors');
    expect(wrapper.emitted('update:dependencyMode')).toEqual([['predecessors']]);
    await select.setValue('successors');
    expect(wrapper.emitted('update:dependencyMode')).toEqual([['predecessors'], ['successors']]);
    expect(wrapper.find('[data-testid="display-control"]').exists()).toBe(true);
  });

  it('PR-TOOLBAR-012: dependency-depth input emits update:dependencyDepth; popover stays open', async () => {
    const wrapper = mount(ReportToolbar, { props: defaultProps });
    await wrapper.find('[data-testid="toggle-display-control"]').trigger('click');
    const input = wrapper.find('[data-testid="dependency-depth"]');
    expect(input.exists()).toBe(true);
    await input.setValue('2');
    expect(wrapper.emitted('update:dependencyDepth')).toEqual([[2]]);
    await input.setValue('-1');
    expect(wrapper.emitted('update:dependencyDepth')).toEqual([[2], [-1]]);
    await input.setValue('-5');
    expect(wrapper.emitted('update:dependencyDepth')?.at(-1)).toEqual([-1]);
    await input.setValue('999999');
    expect(wrapper.emitted('update:dependencyDepth')?.at(-1)).toEqual([100]);
    expect(wrapper.find('[data-testid="display-control"]').exists()).toBe(true);
  });

  it('PR-TOOLBAR-013: OP selector renders for multiple operators and emits selected id', async () => {
    const wrapper = mount(ReportToolbar, {
      props: {
        ...defaultProps,
        operators: [
          { id: 'op1', label: 'op1' },
          { id: 'op2', label: 'op2' },
        ],
        selectedOperatorId: 'op1',
      },
    });

    expect(wrapper.find('[data-testid="op-selector"]').exists()).toBe(true);
    // Trigger always shows OP算子 brand (sketch); operator ids live in the menu.
    expect(wrapper.find('[data-testid="op-selector-label"]').text()).toMatch(/OP算子|OP/);
    expect(wrapper.find('.pr-op-select__trigger').classes()).not.toContain('pr-op-select__trigger--pill');

    await wrapper.find('[data-testid="op-selector"] button').trigger('click');
    const items = wrapper.findAll('[data-testid="op-item"]');
    expect(items).toHaveLength(2);
    expect(items[0].text()).toBe('op1');
    expect(items[1].text()).toBe('op2');
    await items[1].trigger('click');
    expect(wrapper.emitted('update:selectedOperatorId')).toEqual([['op2']]);
  });

  it('PR-TOOLBAR-014: OP selector hidden for zero or one operator (brand shown)', () => {
    const single = mount(ReportToolbar, {
      props: { ...defaultProps, operators: [{ id: 'op1', label: 'op1' }] },
    });
    expect(single.find('[data-testid="op-selector"]').exists()).toBe(false);
    expect(single.find('.pr-tabs__brand').exists()).toBe(true);

    const none = mount(ReportToolbar, { props: defaultProps });
    expect(none.find('[data-testid="op-selector"]').exists()).toBe(false);
  });

  it('PR-TOOLBAR-015: OP selector is text+chevron (no pill fill or divider)', async () => {
    const src = (await import('./ReportToolbar.vue?raw')).default as string;
    expect(src).toMatch(/\.pr-op-select__trigger[\s\S]*?background:\s*transparent/);
    expect(src).not.toMatch(/\.pr-op-select[\s\S]*?border-right:\s*1px solid/);
  });
});
