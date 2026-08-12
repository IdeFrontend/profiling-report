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
    dependencyDepth: 1,
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

  it('PR-TOOLBAR-007: measure toggle renders and emits update:measureMode', async () => {
    const wrapper = mount(ReportToolbar, { props: { ...defaultProps, measureMode: false } });
    const btn = wrapper.find('[data-testid="toggle-measure"]');
    expect(btn.exists()).toBe(true);
    expect(btn.attributes('aria-pressed')).toBe('false');

    await btn.trigger('click');
    expect(wrapper.emitted('update:measureMode')).toEqual([[true]]);
  });

  it('PR-TOOLBAR-007b: measure toggle reflects active state via aria-pressed and --on', () => {
    const wrapper = mount(ReportToolbar, { props: { ...defaultProps, measureMode: true } });
    const btn = wrapper.find('[data-testid="toggle-measure"]');
    expect(btn.attributes('aria-pressed')).toBe('true');
    expect(btn.classes()).toContain('pr-toolbar__icon-btn--on');
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

  it('PR-TOOLBAR-011: 显示控制 carries the dependency depth field', async () => {
    const wrapper = mount(ReportToolbar, { props: defaultProps });
    await wrapper.find('[data-testid="toggle-display-control"]').trigger('click');

    const field = wrapper.find('[data-testid="dependency-depth"]');
    expect(field.exists()).toBe(true);
    expect((field.element as HTMLInputElement).value).toBe('1');

    // Commits on change, not on every keystroke — a half-typed number must not
    // rebuild the graph.
    await field.setValue('5');
    await field.trigger('change');
    expect(wrapper.emitted('update:dependencyDepth')?.at(-1)).toEqual([5]);

    // Cleared field falls back to the shared default instead of emitting NaN.
    await field.setValue('');
    await field.trigger('change');
    expect(wrapper.emitted('update:dependencyDepth')?.at(-1)).toEqual([1]);
  });
});
