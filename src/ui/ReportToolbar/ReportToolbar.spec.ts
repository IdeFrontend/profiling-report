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

  it('PR-TOOLBAR-001: renders toolbar', () => {
    const wrapper = mount(ReportToolbar, { props: defaultProps });
    expect(wrapper.find('[data-testid="report-toolbar"]').exists()).toBe(true);
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
    expect(wrapper.emitted('update:timeUnit')).toBeTruthy();
  });

  it('PR-TOOLBAR-006: emits update:asideVisible when aside toggle is clicked', async () => {
    const wrapper = mount(ReportToolbar, { props: { ...defaultProps, asideAvailable: true } });
    await wrapper.find('[data-testid="toggle-aside"]').trigger('click');
    expect(wrapper.emitted('update:asideVisible')).toBeTruthy();
  });
});
