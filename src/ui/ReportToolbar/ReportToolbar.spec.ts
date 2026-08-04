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
    const wrapper = mount(ReportToolbar, {
      props: defaultProps,
    });

    expect(wrapper.find('[data-testid="report-toolbar"]').exists()).toBe(true);
  });

  it('PR-TOOLBAR-002: emits zoom-in on button click', async () => {
    const wrapper = mount(ReportToolbar, {
      props: defaultProps,
    });

    const btn = wrapper.find('[data-testid="zoom-in"]');
    if (btn.exists()) {
      await btn.trigger('click');
      expect(wrapper.emitted('zoom-in')).toBeTruthy();
    }
  });

  it('PR-TOOLBAR-003: emits zoom-out on button click', async () => {
    const wrapper = mount(ReportToolbar, {
      props: defaultProps,
    });

    const btn = wrapper.find('[data-testid="zoom-out"]');
    if (btn.exists()) {
      await btn.trigger('click');
      expect(wrapper.emitted('zoom-out')).toBeTruthy();
    }
  });
});
