import { describe, expect, it } from 'vitest';
import { mount } from '@vue/test-utils';
import { t } from '../../i18n';
import ReportLayout from './ReportLayout.vue';
import { ASIDE_WIDTH_DEFAULT } from '../panelResize';

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

  it('PR-LAYOUT-004: aside opens at default width with a resize handle', async () => {
    const wrapper = mount(ReportLayout, {
      props: { showAside: true, asideWidth: ASIDE_WIDTH_DEFAULT },
      slots: {
        main: '<div>main</div>',
        aside: '<div data-testid="aside-content">aside</div>',
      },
    });
    const handle = wrapper.find('[data-testid="aside-resize-handle"]');
    expect(handle.exists()).toBe(true);
    expect(handle.attributes('aria-label')).toBe(t('resizeSidebar'));
    expect(wrapper.attributes('style')).toContain(`--pr-aside-width: ${ASIDE_WIDTH_DEFAULT}px`);

    await handle.trigger('pointerdown', { button: 0, clientX: 1000, pointerId: 1 });
    await handle.trigger('pointermove', { clientX: 960, pointerId: 1 });
    expect(wrapper.emitted('update:asideWidth')?.at(-1)?.[0]).toBe(ASIDE_WIDTH_DEFAULT + 40);
  });

  it('PR-LAYOUT-005: main column overflow visible above aside for edge chrome', async () => {
    const src = (await import('./ReportLayout.vue?raw')).default as string;
    expect(src).toMatch(/\.pr-main\s*\{[^}]*overflow:\s*visible/s);
    expect(src).toMatch(/\.pr-main\s*\{[^}]*z-index:\s*1/s);
    expect(src).toMatch(/\.pr-layout__aside\s*\{[^}]*z-index:\s*0/s);
    expect(src).toMatch(/\.pr-layout__aside\s*\{[^}]*background:\s*var\(--pr-bg-aside\)/s);
  });

  it('PR-LAYOUT-006: keeps two-column grid when aside is visible (no viewport stack)', async () => {
    const src = (await import('./ReportLayout.vue?raw')).default as string;
    expect(src).toMatch(
      /grid-template-columns:\s*minmax\(0,\s*1fr\)\s+minmax\(0,\s*var\(--pr-aside-width/,
    );
    const wrapper = mount(ReportLayout, {
      props: { showAside: true, asideWidth: ASIDE_WIDTH_DEFAULT },
      slots: {
        main: '<div data-testid="main-content">main</div>',
        aside: '<div data-testid="aside-content">aside</div>',
      },
    });
    expect(wrapper.find('[data-testid="aside-content"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="aside-resize-handle"]').exists()).toBe(true);

    // Hidden aside collapses the track to 0 (no dedicated --no-aside class anymore).
    const hidden = mount(ReportLayout, {
      props: { showAside: false },
      slots: { main: '<div>main</div>', aside: '<div>aside</div>' },
    });
    expect(hidden.attributes('style')).toContain('--pr-aside-width: 0px');
  });

  it('PR-LAYOUT-007: aside show/hide animates the grid track and fades, except while resizing', async () => {
    const src = (await import('./ReportLayout.vue?raw')).default as string;
    expect(src).toMatch(/\.pr-layout\s*\{[^}]*transition:\s*grid-template-columns\s+200ms\s+ease/s);
    // Resize drag disables the track transition so it never lags the pointer.
    expect(src).toMatch(/\.pr-layout--resizing\s*\{[^}]*transition:\s*none/s);
    expect(src).toMatch(/\.pr-aside-enter-from,[^}]*opacity:\s*0/s);
    expect(src).toMatch(/\.pr-aside-leave-to[^}]*opacity:\s*0/s);
    expect(src).toMatch(/prefers-reduced-motion:\s*reduce/);
  });
});
