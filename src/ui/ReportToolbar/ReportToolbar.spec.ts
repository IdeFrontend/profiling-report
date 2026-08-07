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

  it('PR-TOOLBAR-005: emits update:timeUnit when unit is changed', async () => {
    const wrapper = mount(ReportToolbar, { props: defaultProps });
    const select = wrapper.find('[data-testid="time-unit"]');
    await select.setValue('us');
    expect(wrapper.emitted('update:timeUnit')).toEqual([['us']]);
  });

  it('PR-TOOLBAR-006: emits update:asideVisible when aside toggle is clicked', async () => {
    const wrapper = mount(ReportToolbar, { props: { ...defaultProps, asideAvailable: true } });
    await wrapper.find('[data-testid="toggle-aside"]').trigger('click');
    expect(wrapper.emitted('update:asideVisible')).toEqual([[true]]);
  });

  it('PR-TOOLBAR-007: emits update:measureMode when measure toggle is clicked', async () => {
    const wrapper = mount(ReportToolbar, { props: { ...defaultProps, measureMode: false } });
    await wrapper.find('[data-testid="toggle-measure"]').trigger('click');
    expect(wrapper.emitted('update:measureMode')).toEqual([[true]]);
  });

  it('PR-TOOLBAR-008: search magnifier SVG and zoom compound pill chrome', () => {
    const wrapper = mount(ReportToolbar, { props: defaultProps });
    expect(wrapper.find('[data-testid="search-magnifier"]').exists()).toBe(true);
    expect(wrapper.find('.pr-toolbar__zoom-pill').exists()).toBe(true);
    expect(wrapper.find('[data-testid="zoom-out"] svg').exists()).toBe(true);
    expect(wrapper.find('[data-testid="zoom-in"] svg').exists()).toBe(true);
    expect(wrapper.find('[data-testid="zoom-to-fit"] svg').exists()).toBe(true);
  });
});
