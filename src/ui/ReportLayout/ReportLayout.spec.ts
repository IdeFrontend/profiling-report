import { describe, expect, it } from 'vitest';
import { mount } from '@vue/test-utils';
import ReportLayout from './ReportLayout.vue';

describe('ReportLayout', () => {
  it('PR-LAYOUT-001: renders main slot', () => {
    const wrapper = mount(ReportLayout, {
      props: { showAside: false },
      slots: { main: '<div data-testid="main-content">main</div>' },
    });

    expect(wrapper.find('[data-testid="main-content"]').exists()).toBe(true);
  });

  it('PR-LAYOUT-002: shows aside when showAside is true', () => {
    const wrapper = mount(ReportLayout, {
      props: { showAside: true },
      slots: {
        main: '<div>main</div>',
        aside: '<div data-testid="aside-content">aside</div>',
      },
    });

    expect(wrapper.find('[data-testid="aside-content"]').exists()).toBe(true);
  });

  it('PR-LAYOUT-003: hides aside when showAside is false', () => {
    const wrapper = mount(ReportLayout, {
      props: { showAside: false },
      slots: {
        main: '<div>main</div>',
        aside: '<div data-testid="aside-content">aside</div>',
      },
    });

    expect(wrapper.find('[data-testid="aside-content"]').exists()).toBe(false);
  });

  it('PR-LAYOUT-004: exposes aside resize handle when aside is visible', () => {
    const wrapper = mount(ReportLayout, {
      props: { showAside: true, asideWidth: 360 },
      slots: {
        main: '<div>main</div>',
        aside: '<div data-testid="aside-content">aside</div>',
      },
    });
    expect(wrapper.find('[data-testid="aside-resize-handle"]').exists()).toBe(true);
  });
});
