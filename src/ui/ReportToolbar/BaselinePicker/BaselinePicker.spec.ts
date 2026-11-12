import { describe, expect, it, vi } from 'vitest';
import { nextTick } from 'vue';
import { flushPromises, mount } from '@vue/test-utils';
import BaselinePicker from './BaselinePicker.vue';
import type { Baseline, BaselinePick } from '../../../domain/types';
import { t } from '../../../i18n';

describe('BaselinePicker', () => {
  const recentBaselines: Baseline[] = [
    {
      id: 'r1',
      name: 'OPPROF_20261108142517_QKWFPLXZVTRNBGMA',
      path: '/workspace/.vscode/opprof/OPPROF_20261108142517_QKWFPLXZVTRNBGMA',
    },
    {
      id: 'r2',
      name: 'OPPROF_20261109111842_MJNHEYSDCQXVBRUW',
      path: '/workspace/.vscode/opprof/OPPROF_20261109111842_MJNHEYSDCQXVBRUW',
    },
  ];

  function mountPicker(overrides: {
    baselines?: Baseline[];
    pickBaselineFile?: () => Promise<BaselinePick | null>;
    recentBaselines?: Baseline[];
    locale?: string;
    attachToBody?: boolean;
  } = {}) {
    const { attachToBody, ...props } = overrides;
    return mount(BaselinePicker, {
      props: {
        baselines: [],
        pickBaselineFile: vi.fn().mockResolvedValue(null),
        recentBaselines,
        ...props,
      },
      attachTo: attachToBody ? document.body : undefined,
    });
  }

  async function open(wrapper: ReturnType<typeof mountPicker>) {
    await wrapper.find('[data-testid="toggle-baselines"]').trigger('click');
  }

  function outsidePointerDown() {
    document.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
  }

  function escapePress() {
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
  }

  it('PR-BASELINE-001: trigger renders only when pickBaselineFile is provided', () => {
    const noHook = mount(BaselinePicker, {
      props: { baselines: [], recentBaselines },
    });
    expect(noHook.find('[data-testid="toggle-baselines"]').exists()).toBe(false);
    noHook.unmount();

    const withHook = mountPicker();
    expect(withHook.find('[data-testid="toggle-baselines"]').exists()).toBe(true);
    withHook.unmount();
  });

  it('PR-BASELINE-002: click opens the checkbox view with the host reports and Browse', async () => {
    const wrapper = mountPicker();
    expect(wrapper.find('[data-testid="baselines-popover"]').exists()).toBe(false);
    await open(wrapper);
    const pop = wrapper.get('[data-testid="baselines-popover"]');
    expect(pop.text()).toContain(t('baselineAddTitle'));
    expect(wrapper.find('[data-testid="baselines-recent-list"]').exists()).toBe(true);
    expect(wrapper.findAll('[data-testid="baseline-check"]')).toHaveLength(2);
    expect(wrapper.find('[data-testid="baseline-browse"]').exists()).toBe(true);
    // The single view is the checkbox view — no radios, no footer actions beyond Browse.
    expect(wrapper.find('[data-testid="baseline-radio"]').exists()).toBe(false);
    expect(wrapper.find('[data-testid="baseline-add-selected"]').exists()).toBe(false);
    expect(wrapper.find('[data-testid="baseline-set-current"]').exists()).toBe(false);
    wrapper.unmount();
  });

  it('PR-BASELINE-003: rows render name + dimmed path; the checked state is the host list', async () => {
    const wrapper = mountPicker({ baselines: [recentBaselines[0]] });
    await open(wrapper);
    const rows = wrapper.findAll('.pr-baseline__item--check');
    expect(rows).toHaveLength(2);
    expect(rows[0].text()).toContain('OPPROF_20261108142517');
    expect(rows[0].text()).toContain('/workspace/.vscode/opprof/');
    expect((rows[0].get('[data-testid="baseline-check"]').element as HTMLInputElement).checked).toBe(true);
    expect((rows[1].get('[data-testid="baseline-check"]').element as HTMLInputElement).checked).toBe(false);
    wrapper.unmount();
  });

  it('PR-BASELINE-023: checking a row emits the appended list; unchecking removes it — the state is host-owned', async () => {
    const wrapper = mountPicker();
    await open(wrapper);
    // A real host applies each emitted list back through the prop — the
    // picker keeps no private state.
    const applyEmitted = async () => {
      const emitted = wrapper.emitted('update:baselines');
      expect(emitted).toBeTruthy();
      await wrapper.setProps({
        baselines: emitted![emitted!.length - 1][0] as Baseline[],
      });
    };
    const checks = () => wrapper.findAll('[data-testid="baseline-check"]');

    await checks()[0].setValue(true);
    await applyEmitted();
    expect((checks()[0].element as HTMLInputElement).checked).toBe(true);

    await checks()[1].setValue(true);
    await applyEmitted();
    expect((checks()[0].element as HTMLInputElement).checked).toBe(true);
    expect((checks()[1].element as HTMLInputElement).checked).toBe(true);

    await checks()[0].setValue(false);
    await applyEmitted();
    expect((checks()[0].element as HTMLInputElement).checked).toBe(false);
    expect((checks()[1].element as HTMLInputElement).checked).toBe(true);
    expect(wrapper.emitted('update:baselines')).toEqual([
      [[recentBaselines[0]]],
      [[recentBaselines[0], recentBaselines[1]]],
      [[recentBaselines[1]]],
    ]);

    // Closing and reopening keeps the host-owned checked set (no local reset).
    await wrapper.get('[data-testid="baselines-close"]').trigger('click');
    await open(wrapper);
    expect(
      (wrapper.findAll('[data-testid="baseline-check"]')[1].element as HTMLInputElement).checked,
    ).toBe(true);
    expect(
      (wrapper.findAll('[data-testid="baseline-check"]')[0].element as HTMLInputElement).checked,
    ).toBe(false);
    wrapper.unmount();
  });

  it('PR-BASELINE-024: checked entries missing from the recent list render as extra rows; unchecking keeps focus in the list', async () => {
    const extra: Baseline = { id: 'browse-1', name: 'picked.npu-rep', path: '/picked' };
    const wrapper = mountPicker({ baselines: [extra], attachToBody: true });
    await open(wrapper);
    const rows = wrapper.findAll('.pr-baseline__item--check');
    expect(rows).toHaveLength(3);
    expect(rows[2].text()).toContain('picked.npu-rep');
    const extraInput = rows[2].get('[data-testid="baseline-check"]');
    expect((extraInput.element as HTMLInputElement).checked).toBe(true);
    // Unchecking an extra row removes it from the list.
    (extraInput.element as HTMLInputElement).focus();
    await extraInput.setValue(false);
    expect(wrapper.emitted('update:baselines')).toEqual([[[]]]);
    // The host applies the list, the row unmounts, focus moves to the neighbour
    // (the previous recent row here) instead of falling to `body`.
    await wrapper.setProps({ baselines: [] });
    await flushPromises();
    const checks = wrapper.findAll('[data-testid="baseline-check"]');
    expect(checks).toHaveLength(2);
    expect(document.activeElement).toBe(checks[1].element);
    wrapper.unmount();
  });

  it('PR-BASELINE-025: Browse appends the pick as a checked row; the same path is not re-added', async () => {
    const pick: BaselinePick = { path: '/data/extra.npu-rep', name: 'extra.npu-rep' };
    const hook = vi.fn().mockResolvedValue(pick);
    const wrapper = mountPicker({ pickBaselineFile: hook });
    await open(wrapper);
    await wrapper.get('[data-testid="baseline-browse"]').trigger('click');
    await flushPromises();
    const lists = wrapper.emitted('update:baselines');
    expect(lists).toHaveLength(1);
    const appended = lists![0][0] as Baseline[];
    expect(appended).toHaveLength(1);
    expect(appended[0]).toMatchObject({ name: 'extra.npu-rep', path: '/data/extra.npu-rep' });
    expect(typeof appended[0].id).toBe('string');
    // The host applies the list back — the picked report renders as a checked
    // row beyond the recent list.
    await wrapper.setProps({ baselines: appended });
    const rows = wrapper.findAll('.pr-baseline__item--check');
    expect(rows).toHaveLength(3);
    expect((rows[2].get('[data-testid="baseline-check"]').element as HTMLInputElement).checked).toBe(true);

    // Browse again with the same path: no emit (already checked).
    await wrapper.get('[data-testid="baseline-browse"]').trigger('click');
    await flushPromises();
    expect(wrapper.emitted('update:baselines')).toHaveLength(1);
    wrapper.unmount();
  });

  it('PR-BASELINE-006: Browse calls pickBaselineFile; a null result emits nothing', async () => {
    const hook = vi.fn().mockResolvedValue(null);
    const wrapper = mountPicker({ pickBaselineFile: hook });
    await open(wrapper);
    await wrapper.get('[data-testid="baseline-browse"]').trigger('click');
    await flushPromises();
    expect(hook).toHaveBeenCalledTimes(1);
    expect(wrapper.emitted('update:baselines')).toBeUndefined();
    expect(wrapper.find('[data-testid="baselines-popover"]').exists()).toBe(true);
    wrapper.unmount();
  });

  it('PR-BASELINE-029: Browse disables while the host pick is in flight', async () => {
    let resolvePick: (pick: BaselinePick | null) => void = () => {};
    const hook = vi.fn(
      () => new Promise<BaselinePick | null>((resolve) => { resolvePick = resolve; }),
    );
    const wrapper = mountPicker({ pickBaselineFile: hook });
    await open(wrapper);
    const browse = () => wrapper.get('[data-testid="baseline-browse"]');
    await browse().trigger('click');
    expect(browse().attributes('disabled')).toBeDefined();
    // A second press while the dialog is open must not open another one.
    await browse().trigger('click');
    expect(hook).toHaveBeenCalledTimes(1);
    resolvePick(null);
    await flushPromises();
    expect(browse().attributes('disabled')).toBeUndefined();
    wrapper.unmount();
  });

  it('PR-BASELINE-008: dismiss via ×, second press, outside pointerdown, Escape', async () => {
    const wrapper = mountPicker();
    const pop = () => wrapper.find('[data-testid="baselines-popover"]');

    await open(wrapper);
    await wrapper.get('[data-testid="baselines-close"]').trigger('click');
    expect(pop().exists()).toBe(false);

    await open(wrapper);
    await wrapper.get('[data-testid="toggle-baselines"]').trigger('click');
    expect(pop().exists()).toBe(false);

    await open(wrapper);
    outsidePointerDown();
    await nextTick();
    expect(pop().exists()).toBe(false);

    await open(wrapper);
    escapePress();
    await nextTick();
    expect(pop().exists()).toBe(false);
    wrapper.unmount();
  });

  it('PR-BASELINE-009: aria-expanded and --on track open state; labels come from i18n', async () => {
    const wrapper = mountPicker();
    const trigger = wrapper.get('[data-testid="toggle-baselines"]');
    expect(trigger.attributes('aria-expanded')).toBe('false');
    expect(trigger.attributes('aria-label')).toBe(t('baselines'));

    await open(wrapper);
    expect(wrapper.get('[data-testid="toggle-baselines"]').attributes('aria-expanded')).toBe('true');
    expect(wrapper.get('[data-testid="toggle-baselines"]').classes()).toContain('pr-toolbar__icon-btn--on');
    expect(wrapper.get('[data-testid="baseline-browse"]').text()).toContain(t('baselineBrowse'));
    wrapper.unmount();

    const en = mountPicker({ locale: 'en' });
    expect(en.get('[data-testid="toggle-baselines"]').attributes('aria-label')).toBe('Baselines');
    await open(en);
    expect(en.get('[data-testid="baselines-popover"]').text()).toContain('Add baselines');
    expect(en.get('[data-testid="baseline-browse"]').text()).toContain('Browse');
    en.unmount();
  });

  it('PR-BASELINE-010: trigger renders with the shared toolbar action-icon chrome', async () => {
    // The rendered class is the contract here — the tokens.css block itself is
    // owned by PR-TOOLBAR-009c (ReportToolbar.spec.ts), one owner per rule.
    const wrapper = mountPicker();
    const trigger = wrapper.get('[data-testid="toggle-baselines"]');
    expect(trigger.classes()).toContain('pr-toolbar__icon-btn');
    expect(trigger.classes()).toContain('pr-icon-tip');
    wrapper.unmount();
  });

  it('PR-BASELINE-008b: Escape and × restore focus to the trigger; outside pointerdown does not', async () => {
    // Focus assertions need the tree attached to the document (happy-dom
    // ignores focus() on detached elements).
    const wrapper = mountPicker({ attachToBody: true });
    const trigger = wrapper.get('[data-testid="toggle-baselines"]');
    (trigger.element as HTMLButtonElement).focus();

    await open(wrapper);
    escapePress();
    await flushPromises();
    expect(document.activeElement).toBe(trigger.element);
    expect(wrapper.find('[data-testid="baselines-popover"]').exists()).toBe(false);

    await open(wrapper);
    await wrapper.get('[data-testid="baselines-close"]').trigger('click');
    await flushPromises();
    expect(document.activeElement).toBe(trigger.element);

    await open(wrapper);
    const outside = document.createElement('button');
    document.body.appendChild(outside);
    outside.focus();
    outside.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
    await nextTick();
    expect(wrapper.find('[data-testid="baselines-popover"]').exists()).toBe(false);
    // The user clicked elsewhere — focus stays there, not yanked to the trigger.
    expect(document.activeElement).toBe(outside);
    outside.remove();
    wrapper.unmount();
  });

  it('PR-BASELINE-011: trigger renders the mockup-extracted add-baseline mask', async () => {
    const wrapper = mountPicker();
    const icon = wrapper.get('[data-testid="toggle-baselines"] .pr-icon');
    expect(icon.classes()).toContain('pr-icon--add-baseline');
    const prIcon = (await import('../../PrIcon.vue?raw')).default as string;
    expect(prIcon).toMatch(/\.pr-icon--add-baseline\s*\{[^}]*mask-image:\s*url\('\.\/icons\/add-baseline\.png'\)/);
    wrapper.unmount();
  });

  it('PR-BASELINE-026: without recentBaselines the view shows the empty copy and Browse still works', async () => {
    const wrapper = mountPicker({ recentBaselines: [] });
    await open(wrapper);
    expect(wrapper.get('[data-testid="baselines-recent-empty"]').text()).toBe(
      t('baselineRecentEmpty'),
    );
    expect(wrapper.findAll('[data-testid="baseline-check"]')).toHaveLength(0);
    expect(wrapper.find('[data-testid="baseline-browse"]').exists()).toBe(true);
    wrapper.unmount();
  });

  it('PR-BASELINE-027: the panel adapts its width to the content (240–480px)', async () => {
    const src = (await import('./BaselinePicker.vue?raw')).default as string;
    expect(src).toMatch(/\.pr-baseline\s*\{[^}]*width:\s*max-content/s);
    expect(src).toMatch(/\.pr-baseline\s*\{[^}]*min-width:\s*240px/s);
    expect(src).toMatch(/\.pr-baseline\s*\{[^}]*max-width:\s*480px/s);
  });

  it('PR-BASELINE-028: opening enters the dialog — focus on close, trigger linked via aria-controls', async () => {
    const wrapper = mountPicker({ attachToBody: true });
    const trigger = wrapper.get('[data-testid="toggle-baselines"]');
    expect(trigger.attributes('aria-controls')).toBeUndefined();
    await open(wrapper);
    await flushPromises();
    const panel = wrapper.get('[data-testid="baselines-popover"]');
    expect(panel.attributes('id')).toBeTruthy();
    expect(trigger.attributes('aria-controls')).toBe(panel.attributes('id'));
    expect(document.activeElement).toBe(wrapper.get('[data-testid="baselines-close"]').element);
    wrapper.unmount();
  });

  it('PR-BASELINE-031: the checked dot uses the declared accent and a non-colour tick', async () => {
    const src = (await import('./BaselinePicker.vue?raw')).default as string;
    expect(src).toMatch(/:checked ~ \.pr-baseline__check-dot\s*\{[^}]*var\(--pr-accent/s);
    // Colour is not the only cue: a tick glyph paints over the filled square.
    expect(src).toMatch(/:checked ~ \.pr-baseline__check-dot::after\s*\{[^}]*content:/s);
    const { readFileSync } = await import('node:fs');
    const { resolve } = await import('node:path');
    const tokens = readFileSync(resolve(__dirname, '../../tokens.css'), 'utf8');
    expect(tokens).toMatch(/--pr-accent:\s*#[0-9a-f]{6}/i);
  });
});
