import { describe, expect, it, vi } from 'vitest';
import { flushPromises, mount } from '@vue/test-utils';
import ReportToolbar from './ReportToolbar.vue';
import { MAX_DEPENDENCY_DEPTH, MIN_DEPENDENCY_DEPTH } from '../../domain/types';
import { t } from '../../i18n';

describe('ReportToolbar', () => {
  const defaultProps = {
    searchQuery: '',
    asideVisible: false,
    asideAvailable: true,
    zoomPercent: 100,
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

  it('PR-TOOLBAR-005: layers opens display control with dependency depth', async () => {
    const wrapper = mount(ReportToolbar, { props: defaultProps });
    expect(wrapper.find('[data-testid="time-unit"]').exists()).toBe(false);
    expect(wrapper.find('[data-testid="display-control"]').exists()).toBe(false);

    await wrapper.find('[data-testid="toggle-display-control"]').trigger('click');
    expect(wrapper.find('[data-testid="display-control"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="time-unit"]').exists()).toBe(false);
    expect(wrapper.find('[data-testid="dependency-depth"]').exists()).toBe(true);
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
    expect(wrapper.find('[data-testid="measure-icon"]').exists()).toBe(true);

    await btn.trigger('click');
    expect(wrapper.emitted('update:measureMode')).toEqual([[true]]);
  });

  it('PR-TOOLBAR-007b: measure toggle reflects active state via aria-pressed and --on', () => {
    const wrapper = mount(ReportToolbar, { props: { ...defaultProps, measureMode: true } });
    const btn = wrapper.find('[data-testid="toggle-measure"]');
    expect(btn.attributes('aria-pressed')).toBe('true');
    expect(btn.classes()).toContain('pr-toolbar__icon-btn--on');
  });

  it('PR-TOOLBAR-008: search magnifier icon and zoom compound pill chrome', () => {
    const wrapper = mount(ReportToolbar, { props: defaultProps });
    expect(wrapper.find('[data-testid="search-magnifier"]').exists()).toBe(true);
    expect(wrapper.find('.pr-toolbar__zoom-pill').exists()).toBe(true);
    expect(wrapper.find('[data-testid="zoom-out"] .pr-icon--zoom-out').exists()).toBe(true);
    expect(wrapper.find('[data-testid="zoom-in"] .pr-icon--zoom-in').exists()).toBe(true);
    // No design export was supplied for fit, so it keeps its hand-drawn glyph.
    expect(wrapper.find('[data-testid="zoom-to-fit"] svg').exists()).toBe(true);
  });

  it('PR-TOOLBAR-018: corner wash sits inside the strip, above its background, below the tabs', async () => {
    const wrapper = mount(ReportToolbar, { props: defaultProps });
    const wash = wrapper.find('[data-testid="corner-wash"]');
    expect(wash.exists()).toBe(true);

    // The bug this replaces: the wash lived on the report root, where `.pr-main`
    // (z-index: 1, opaque) painted straight over it. Ownership is the fix, so assert it.
    const chrome = wrapper.find('.pr-chrome');
    expect(chrome.element.contains(wash.element)).toBe(true);
    expect(chrome.element.firstElementChild).toBe(wash.element);

    const src = (await import('./ReportToolbar.vue?raw')).default as string;
    expect(src).toMatch(/\.pr-chrome__wash[\s\S]*?width:\s*208px/);
    // top+bottom (not a fixed height) so the wash stretches when the toolbar wraps.
    expect(src).toMatch(/\.pr-chrome__wash[\s\S]*?top:\s*0/);
    expect(src).toMatch(/\.pr-chrome__wash[\s\S]*?bottom:\s*0/);
    expect(src).not.toMatch(/\.pr-chrome__wash[\s\S]*?height:\s*100%/);
    expect(src).toMatch(
      /\.pr-chrome__wash[\s\S]*?radial-gradient\(\s*59%\s*100\.4%\s*at\s*41%\s*0%,\s*rgba\(44,\s*41,\s*175,\s*0\.2\)\s*0%/,
    );
    expect(src).toMatch(
      /\.pr-chrome__wash[\s\S]*?linear-gradient\(\s*90deg,\s*rgba\(0,\s*90,\s*219,\s*0\.1\)\s*3\.614%/,
    );
    // `.pr-chrome` must anchor the wash without becoming a stacking context, or the
    // OP menu and 显示控制 popover can no longer escape the strip.
    expect(src).toMatch(/\.pr-chrome\s*\{[^}]*position:\s*relative/);
    expect(src).not.toMatch(/\.pr-chrome\s*\{[^}]*(z-index|isolation)\s*:/);
    // Tabs paint over the wash only because they are positioned.
    expect(src).toMatch(/\.pr-tabs\s*\{[^}]*position:\s*relative/);
  });

  it('PR-TOOLBAR-016: design icons are currentColor-tinted masks, not per-state glyphs', async () => {
    const wrapper = mount(ReportToolbar, { props: defaultProps });
    for (const name of ['search', 'zoom-in', 'zoom-out', 'stats', 'measure', 'display-config']) {
      expect(wrapper.find(`.pr-icon--${name}`).exists()).toBe(true);
    }

    const src = (await import('../PrIcon.vue?raw')).default as string;
    expect(src).toMatch(/\.pr-icon\s*\{[^}]*background-color:\s*currentColor/);
    expect(src).toMatch(/\.pr-icon\s*\{[^}]*width:\s*16px/);
    expect(src).toMatch(/\.pr-icon\s*\{[^}]*height:\s*16px/);
  });

  it('PR-TOOLBAR-017: connection-level help explains on hover, not via title', async () => {
    const wrapper = mount(ReportToolbar, { props: defaultProps });
    await wrapper.find('[data-testid="toggle-display-control"]').trigger('click');

    const help = wrapper.find('.pr-toolbar__display-help');
    expect(help.exists()).toBe(true);
    expect(help.element.tagName).toBe('BUTTON');
    expect(help.attributes('title')).toBeUndefined();
    expect(help.attributes('type')).toBe('button');
    expect(help.attributes('aria-label')).toBe(t('helpConnectionLevel'));
    expect(help.attributes('aria-label')).not.toBe(t('connectionLevelHelp'));
    expect(help.attributes('aria-describedby')).toBeTruthy();
    expect(help.find('.pr-icon--help').exists()).toBe(true);
    const tip = wrapper.find('[data-testid="connection-level-help"]');
    expect(tip.text()).toBe(t('connectionLevelHelp'));
    expect(tip.attributes('id')).toBe(help.attributes('aria-describedby'));
    expect(tip.attributes('role')).toBe('tooltip');

    const src = (await import('./ReportToolbar.vue?raw')).default as string;
    expect(src).toMatch(/\.pr-toolbar__display-help:hover \.pr-toolbar__display-help-tip/);
  });

  it('PR-TOOLBAR-009: strip/search/zoom surface colors match sketch tokens', async () => {
    const src = (await import('./ReportToolbar.vue?raw')).default as string;
    expect(src).toMatch(/\.pr-chrome[\s\S]*?background:\s*var\(--pr-bg-deep/);
    expect(src).toMatch(/\.pr-chrome\s*\{[^}]*min-height:\s*60px/);
    expect(src).toMatch(/\.pr-chrome\s*\{[^}]*flex-wrap:\s*wrap/);
    expect(src).toMatch(/\.pr-chrome\s*\{[^}]*padding:\s*8px/);
    expect(src).not.toMatch(/\.pr-chrome\s*\{[^}]*[^-\w]height:\s*60px/);
    expect(src).toMatch(/\.pr-chrome\s*\{[^}]*overflow-x:\s*clip/);
    expect(src).toMatch(/\.pr-toolbar\s*\{[^}]*flex-wrap:\s*nowrap/);
    expect(src).toMatch(/\.pr-toolbar\s*\{[^}]*overflow-x:\s*clip/);
    expect(src).toMatch(/\.pr-toolbar\s*\{[^}]*max-width:\s*100%/);
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
    expect(src).toMatch(
      /\.pr-toolbar__display-field input\[type='number'\][\s\S]*?background-color:\s*#404040/,
    );
    expect(src).toMatch(
      /\.pr-toolbar__display-field input\[type='number'\][\s\S]*?border-radius:\s*6px/,
    );
    // No manual unit <select> exists any more (UI-40a auto-scaling units).
    expect(src).not.toMatch(/\.pr-toolbar__display-field select/);
  });

  it('PR-TOOLBAR-009c: action icon rest/hover/pressed match sketch', async () => {
    const src = (await import('./ReportToolbar.vue?raw')).default as string;
    expect(src).toMatch(/\.pr-toolbar__icon-btn\s*\{[^}]*background:\s*#363636/);
    expect(src).toMatch(/\.pr-toolbar__icon-btn\s*\{[^}]*color:\s*#b3b3b3/);
    expect(src).toMatch(/\.pr-toolbar__icon-btn\s*\{[^}]*border-radius:\s*6px/);
    expect(src).toMatch(/\.pr-toolbar__icon-btn:hover[\s\S]*?background:\s*#1e2a3e/);
    expect(src).toMatch(/\.pr-toolbar__icon-btn:hover[\s\S]*?color:\s*#2d70e3/);
  });

  it('PR-TOOLBAR-010: display control closes via X, layers toggle, outside pointerdown, or Escape', async () => {
    const wrapper = mount(ReportToolbar, { props: defaultProps, attachTo: document.body });
    const btn = wrapper.find('[data-testid="toggle-display-control"]');
    await btn.trigger('click');
    expect(wrapper.find('[data-testid="display-control"]').exists()).toBe(true);

    await wrapper.find('[data-testid="display-control-close"]').trigger('click');
    expect(wrapper.find('[data-testid="display-control"]').exists()).toBe(false);

    await btn.trigger('click');
    expect(wrapper.find('[data-testid="display-control"]').exists()).toBe(true);
    await btn.trigger('click');
    expect(wrapper.find('[data-testid="display-control"]').exists()).toBe(false);

    // Outside click: the wrap includes the trigger, so a pointerdown on the body
    // (or any node not under the wrap) is what dismisses.
    await btn.trigger('click');
    expect(wrapper.find('[data-testid="display-control"]').exists()).toBe(true);
    document.body.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
    await flushPromises();
    expect(wrapper.find('[data-testid="display-control"]').exists()).toBe(false);

    // A pointerdown inside the panel must not dismiss — typing / stepping would.
    await btn.trigger('click');
    const panel = wrapper.find('[data-testid="display-control"]').element;
    panel.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
    await flushPromises();
    expect(wrapper.find('[data-testid="display-control"]').exists()).toBe(true);

    // Escape matches APG dialog dismiss (outside pointer alone left Tab-in users stuck).
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    await flushPromises();
    expect(wrapper.find('[data-testid="display-control"]').exists()).toBe(false);

    wrapper.unmount();
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

  it('PR-TOOLBAR-019: the depth stepper steps by one, stops at both clamps, and stays out of the tab order', async () => {
    const open = async (dependencyDepth: number) => {
      const wrapper = mount(ReportToolbar, { props: { ...defaultProps, dependencyDepth } });
      await wrapper.find('[data-testid="toggle-display-control"]').trigger('click');
      return wrapper;
    };

    const mid = await open(3);
    await mid.find('[data-testid="dependency-depth-up"]').trigger('click');
    expect(mid.emitted('update:dependencyDepth')?.at(-1)).toEqual([4]);
    await mid.find('[data-testid="dependency-depth-down"]').trigger('click');
    expect(mid.emitted('update:dependencyDepth')?.at(-1)).toEqual([2]);

    // -1 is the sentinel for "walk the whole chain", so there is nothing below it.
    const floor = await open(MIN_DEPENDENCY_DEPTH);
    expect(floor.find('[data-testid="dependency-depth-down"]').attributes('disabled')).toBeDefined();
    expect(floor.find('[data-testid="dependency-depth-up"]').attributes('disabled')).toBeUndefined();

    const ceiling = await open(MAX_DEPENDENCY_DEPTH);
    expect(ceiling.find('[data-testid="dependency-depth-up"]').attributes('disabled')).toBeDefined();

    // A number input already steps on ArrowUp / ArrowDown, so the buttons are a pointer
    // affordance only; exposing them would announce a second copy of the same control.
    const steps = mid.find('.pr-toolbar__display-steps');
    expect(steps.attributes('aria-hidden')).toBe('true');
    for (const b of mid.findAll('.pr-toolbar__display-step')) {
      expect(b.attributes('tabindex')).toBe('-1');
    }
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
    // Trigger shows the selected operator label.
    expect(wrapper.find('[data-testid="op-selector-label"]').text()).toBe('op1');
    expect(wrapper.find('.pr-op-select__trigger').classes()).not.toContain('pr-op-select__trigger--pill');

    await wrapper.find('[data-testid="op-selector"] button').trigger('click');
    const items = wrapper.findAll('[data-testid="op-item"]');
    expect(items).toHaveLength(2);
    expect(items[0].text()).toBe('op1');
    expect(items[1].text()).toBe('op2');
    await items[1].trigger('click');
    expect(wrapper.emitted('update:selectedOperatorId')).toEqual([['op2']]);
  });

  it('PR-TOOLBAR-013a: trigger label follows selectedOperatorId', async () => {
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
    expect(wrapper.find('[data-testid="op-selector-label"]').text()).toBe('op1');
    await wrapper.setProps({ selectedOperatorId: 'op2' });
    expect(wrapper.find('[data-testid="op-selector-label"]').text()).toBe('op2');
  });

  it('PR-TOOLBAR-013b: OP listbox supports Escape / Enter / ArrowDown', async () => {
    const wrapper = mount(ReportToolbar, {
      attachTo: document.body,
      props: {
        ...defaultProps,
        operators: [
          { id: 'op1', label: 'op1' },
          { id: 'op2', label: 'op2' },
        ],
        selectedOperatorId: 'op1',
      },
    });

    const trigger = wrapper.find('[data-testid="op-selector"] button');
    await trigger.trigger('keydown', { key: 'ArrowDown' });
    const menu = wrapper.find('[role="listbox"]');
    expect(menu.exists()).toBe(true);
    expect(trigger.attributes('aria-controls')).toBe(menu.attributes('id'));
    expect(menu.attributes('id')).toBeTruthy();

    const items = wrapper.findAll('[data-testid="op-item"]');
    expect(items[0].attributes('tabindex')).toBe('0');
    await items[0].trigger('keydown', { key: 'ArrowDown' });
    await wrapper.findAll('[data-testid="op-item"]')[1].trigger('keydown', { key: 'Enter' });
    await flushPromises();
    expect(wrapper.emitted('update:selectedOperatorId')).toEqual([['op2']]);
    expect(wrapper.find('[role="listbox"]').exists()).toBe(false);
    expect(document.activeElement).toBe(trigger.element);

    await trigger.trigger('click');
    expect(wrapper.find('[role="listbox"]').exists()).toBe(true);
    await wrapper.findAll('[data-testid="op-item"]')[0].trigger('keydown', { key: 'Escape' });
    await flushPromises();
    expect(wrapper.find('[role="listbox"]').exists()).toBe(false);
    expect(document.activeElement).toBe(trigger.element);
    wrapper.unmount();
  });

  it('PR-TOOLBAR-013c: re-selecting active operator does not emit', async () => {
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
    await wrapper.find('[data-testid="op-selector"] button').trigger('click');
    await wrapper.findAll('[data-testid="op-item"]')[0].trigger('click');
    expect(wrapper.emitted('update:selectedOperatorId')).toBeUndefined();
  });

  it('PR-TOOLBAR-013d: closing selector clears open menu state', async () => {
    const ops = [
      { id: 'op1', label: 'op1' },
      { id: 'op2', label: 'op2' },
    ];
    const wrapper = mount(ReportToolbar, {
      props: { ...defaultProps, operators: ops, selectedOperatorId: 'op1' },
    });
    await wrapper.find('[data-testid="op-selector"] button').trigger('click');
    expect(wrapper.find('[role="listbox"]').exists()).toBe(true);

    await wrapper.setProps({ operators: [{ id: 'op1', label: 'op1' }] });
    expect(wrapper.find('[data-testid="op-selector"]').exists()).toBe(false);

    await wrapper.setProps({ operators: ops, selectedOperatorId: 'op1' });
    expect(wrapper.find('[data-testid="op-selector"]').exists()).toBe(true);
    expect(wrapper.find('[role="listbox"]').exists()).toBe(false);
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
    expect(src).toMatch(/\.pr-op-select__trigger[\s\S]*?font-size:\s*18px/);
    expect(src).toMatch(/\.pr-op-select__trigger[\s\S]*?font-weight:\s*700/);
    expect(src).toMatch(/\.pr-op-select__trigger[\s\S]*?line-height:\s*26px/);
    expect(src).not.toMatch(/\.pr-op-select[\s\S]*?border-right:\s*1px solid/);
  });

  it('PR-TOOLBAR-020: clipped trailing actions get inert; search/zoom never do', async () => {
    const wrapper = mount(ReportToolbar, { props: defaultProps, attachTo: document.body });
    const bar = wrapper.find('.pr-toolbar').element as HTMLElement;
    const fit = wrapper.find('[data-testid="zoom-to-fit"]').element as HTMLElement;
    const measure = wrapper.find('[data-testid="toggle-measure"]').element as HTMLElement;
    const layers = wrapper.find('[data-testid="toggle-display-control"]').element as HTMLElement;
    const aside = wrapper.find('[data-testid="toggle-aside"]').element as HTMLElement;
    const search = wrapper.find('.pr-toolbar__search').element as HTMLElement;

    expect(fit.hasAttribute('data-toolbar-clip')).toBe(true);
    expect(measure.hasAttribute('data-toolbar-clip')).toBe(true);
    expect(layers.hasAttribute('data-toolbar-clip')).toBe(true);
    expect(aside.hasAttribute('data-toolbar-clip')).toBe(true);
    expect(search.hasAttribute('data-toolbar-clip')).toBe(false);

    const rect = (left: number, right: number, width = right - left) =>
      ({
        x: left,
        y: 0,
        left,
        right,
        top: 0,
        bottom: 28,
        width,
        height: 28,
        toJSON() {
          return this;
        },
      }) as DOMRect;

    vi.spyOn(bar, 'getBoundingClientRect').mockReturnValue(rect(0, 100));
    vi.spyOn(fit, 'getBoundingClientRect').mockReturnValue(rect(40, 68));
    vi.spyOn(measure, 'getBoundingClientRect').mockReturnValue(rect(90, 118));
    vi.spyOn(layers, 'getBoundingClientRect').mockReturnValue(rect(120, 148));
    vi.spyOn(aside, 'getBoundingClientRect').mockReturnValue(rect(150, 178));

    (wrapper.vm as { syncToolbarClipInert: () => void }).syncToolbarClipInert();
    expect(fit.hasAttribute('inert')).toBe(false);
    expect(measure.hasAttribute('inert')).toBe(true);
    expect(layers.hasAttribute('inert')).toBe(true);
    expect(aside.hasAttribute('inert')).toBe(true);

    wrapper.unmount();
  });
});
