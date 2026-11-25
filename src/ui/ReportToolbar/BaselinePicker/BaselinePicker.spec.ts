import { afterEach, describe, expect, it, vi } from 'vitest';
import { nextTick } from 'vue';
import { flushPromises, mount } from '@vue/test-utils';
import BaselinePicker from './BaselinePicker.vue';
import type { Baseline, BaselinePick } from '../../../domain/types';
import { t } from '../../../i18n';

/**
 * The panel TELEPORTS to `body` (PR-BASELINE-027: it must clear the body-level
 * OverviewCharts hover stems at z-index 998), so every assertion on the panel
 * content reads the document, not the wrapper.
 */
const q = <T extends HTMLElement = HTMLElement>(selector: string): T | null =>
  document.querySelector<T>(selector);
const qa = <T extends HTMLElement = HTMLElement>(selector: string): T[] =>
  [...document.querySelectorAll<T>(selector)];
const pop = () => q('[data-testid="baselines-popover"]');
const checkRows = () => qa('.pr-baseline__item--check');
const checks = () => qa<HTMLInputElement>('[data-testid="baseline-check"]');
const rowNames = () => qa('.pr-baseline__name').map((el) => el.textContent ?? '');

async function click(selector: string): Promise<void> {
  const el = q(selector);
  expect(el, selector).not.toBeNull();
  el!.click();
  await nextTick();
}

async function setChecked(el: HTMLInputElement | undefined, checked: boolean): Promise<void> {
  expect(el).toBeDefined();
  el!.checked = checked;
  el!.dispatchEvent(new Event('change'));
  await nextTick();
}

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

  afterEach(() => {
    document.querySelectorAll('[data-testid="baselines-popover"]').forEach((el) => el.remove());
  });

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
    expect(pop()).toBeNull();
    await open(wrapper);
    expect(pop()!.textContent).toContain(t('baselineAddTitle'));
    expect(q('[data-testid="baselines-recent-list"]')).not.toBeNull();
    expect(checks()).toHaveLength(2);
    expect(q('[data-testid="baseline-browse"]')).not.toBeNull();
    // The single view is the checkbox view — no radios, no footer actions beyond Browse.
    expect(q('[data-testid="baseline-radio"]')).toBeNull();
    expect(q('[data-testid="baseline-add-selected"]')).toBeNull();
    expect(q('[data-testid="baseline-set-current"]')).toBeNull();
    wrapper.unmount();
  });

  it('PR-BASELINE-003: rows render name + dimmed path; the checked state is the host list', async () => {
    const wrapper = mountPicker({ baselines: [recentBaselines[0]] });
    await open(wrapper);
    const rows = checkRows();
    expect(rows).toHaveLength(2);
    // The generated OPPROF id is replaced by the derived title (PR-BASELINE-029):
    // the path's filename is itself an OPPROF run id, so the title is the
    // timestamp parsed from the name alone — never the boilerplate id.
    expect(rowNames()[0]).toBe('2026-11-08 14:25');
    expect(rows[0].textContent).toContain('/workspace/.vscode/opprof/');
    expect(checks()[0].checked).toBe(true);
    expect(checks()[1].checked).toBe(false);
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

    await setChecked(checks()[0], true);
    await applyEmitted();
    expect(checks()[0].checked).toBe(true);

    await setChecked(checks()[1], true);
    await applyEmitted();
    expect(checks()[0].checked).toBe(true);
    expect(checks()[1].checked).toBe(true);

    await setChecked(checks()[0], false);
    await applyEmitted();
    expect(checks()[0].checked).toBe(false);
    expect(checks()[1].checked).toBe(true);
    expect(wrapper.emitted('update:baselines')).toEqual([
      [[recentBaselines[0]]],
      [[recentBaselines[0], recentBaselines[1]]],
      [[recentBaselines[1]]],
    ]);

    // Closing and reopening keeps the host-owned checked set (no local reset).
    await click('[data-testid="baselines-close"]');
    await open(wrapper);
    expect(checks()[1].checked).toBe(true);
    expect(checks()[0].checked).toBe(false);
    wrapper.unmount();
  });

  it('PR-BASELINE-024: checked entries missing from the recent list render as extra rows', async () => {
    const extra: Baseline = { id: 'browse-1', name: 'picked.npu-rep', path: '/picked' };
    const wrapper = mountPicker({ baselines: [extra] });
    await open(wrapper);
    const rows = checkRows();
    expect(rows).toHaveLength(3);
    expect(rows[2].textContent).toContain('picked.npu-rep');
    expect(checks()[2].checked).toBe(true);
    // Unchecking an extra row removes it from the list.
    await setChecked(checks()[2], false);
    expect(wrapper.emitted('update:baselines')).toEqual([[[]]]);
    wrapper.unmount();
  });

  it('PR-BASELINE-025: Browse appends the pick as a checked row; the same path is not re-added', async () => {
    const pick: BaselinePick = { path: '/data/extra.npu-rep', name: 'extra.npu-rep' };
    const hook = vi.fn().mockResolvedValue(pick);
    const wrapper = mountPicker({ pickBaselineFile: hook });
    await open(wrapper);
    // PR-BASELINE-030: the derived title's timestamp — the pick moment when
    // the pick carries no mtime (sampled around the emit).
    const before = Date.now();
    await click('[data-testid="baseline-browse"]');
    await flushPromises();
    const lists = wrapper.emitted('update:baselines');
    expect(lists).toHaveLength(1);
    const appended = lists![0][0] as Baseline[];
    expect(appended).toHaveLength(1);
    expect(appended[0]).toMatchObject({ name: 'extra.npu-rep', path: '/data/extra.npu-rep' });
    expect(typeof appended[0].id).toBe('string');
    expect(typeof appended[0].pickedAt).toBe('number');
    expect(appended[0].pickedAt!).toBeLessThanOrEqual(Date.now());
    expect(appended[0].pickedAt!).toBeGreaterThanOrEqual(before);
    // The host applies the list back — the picked report renders as a checked
    // row beyond the recent list.
    await wrapper.setProps({ baselines: appended });
    const rows = checkRows();
    expect(rows).toHaveLength(3);
    expect(checks()[2].checked).toBe(true);

    // Browse again with the same path: no emit (already checked).
    await click('[data-testid="baseline-browse"]');
    await flushPromises();
    expect(wrapper.emitted('update:baselines')).toHaveLength(1);
    wrapper.unmount();
  });

  it('PR-BASELINE-006: Browse calls pickBaselineFile; a null result emits nothing', async () => {
    const hook = vi.fn().mockResolvedValue(null);
    const wrapper = mountPicker({ pickBaselineFile: hook });
    await open(wrapper);
    await click('[data-testid="baseline-browse"]');
    await flushPromises();
    expect(hook).toHaveBeenCalledTimes(1);
    expect(wrapper.emitted('update:baselines')).toBeUndefined();
    expect(pop()).not.toBeNull();
    wrapper.unmount();
  });

  it('PR-BASELINE-008: dismiss via ×, second press, outside pointerdown, Escape', async () => {
    const wrapper = mountPicker();

    await open(wrapper);
    await click('[data-testid="baselines-close"]');
    expect(pop()).toBeNull();

    await open(wrapper);
    await open(wrapper);
    expect(pop()).toBeNull();

    await open(wrapper);
    outsidePointerDown();
    await nextTick();
    expect(pop()).toBeNull();

    await open(wrapper);
    escapePress();
    await nextTick();
    expect(pop()).toBeNull();
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
    expect(q('[data-testid="baseline-browse"]')!.textContent).toContain(t('baselineBrowse'));
    wrapper.unmount();

    const en = mountPicker({ locale: 'en' });
    expect(en.get('[data-testid="toggle-baselines"]').attributes('aria-label')).toBe('Baselines');
    await open(en);
    expect(pop()!.textContent).toContain('Select baselines');
    expect(q('[data-testid="baseline-browse"]')!.textContent).toContain('Browse');
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
    expect(pop()).toBeNull();

    await open(wrapper);
    await click('[data-testid="baselines-close"]');
    await flushPromises();
    expect(document.activeElement).toBe(trigger.element);

    await open(wrapper);
    const outside = document.createElement('button');
    document.body.appendChild(outside);
    outside.focus();
    outside.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
    await nextTick();
    expect(pop()).toBeNull();
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
    expect(q('[data-testid="baselines-recent-empty"]')!.textContent!.trim()).toBe(
      t('baselineRecentEmpty'),
    );
    expect(checks()).toHaveLength(0);
    expect(q('[data-testid="baseline-browse"]')).not.toBeNull();
    wrapper.unmount();
  });

  it('PR-BASELINE-027: the panel teleports to body, fixed under the trigger at z-index 1000, 240–480px wide', async () => {
    const wrapper = mountPicker();
    await open(wrapper);
    await nextTick();
    const panel = pop()!;
    // Teleported out of the toolbar tree: an in-tree popover lives under
    // `.pr-main`'s z-index 1 and can never paint over the body-level overview
    // stems (z-index 998) — the bug this panel must not regress into.
    expect(panel.parentElement).toBe(document.body);
    expect(panel.style.position).toBe('fixed');
    expect(panel.style.zIndex).toBe('1000');
    expect(panel.style.left).not.toBe('');
    expect(panel.style.top).not.toBe('');
    wrapper.unmount();

    const src = (await import('./BaselinePicker.vue?raw')).default as string;
    expect(src).toMatch(/<Teleport to="body">/);
    expect(src).toMatch(/\.pr-baseline\s*\{[^}]*width:\s*max-content/s);
    expect(src).toMatch(/\.pr-baseline\s*\{[^}]*min-width:\s*240px/s);
    expect(src).toMatch(/\.pr-baseline\s*\{[^}]*max-width:\s*480px/s);
  });

  it('PR-BASELINE-028: the exposed close() dismisses an open popover without focus restore', async () => {
    const wrapper = mountPicker();
    await open(wrapper);
    expect(pop()).not.toBeNull();
    (wrapper.vm as unknown as { close: () => Promise<void> }).close();
    await nextTick();
    expect(pop()).toBeNull();
    // A no-op when already closed.
    (wrapper.vm as unknown as { close: () => Promise<void> }).close();
    await nextTick();
    expect(pop()).toBeNull();
    wrapper.unmount();
  });

  it('PR-BASELINE-029: row titles derive from filename + timestamp instead of a generated id', async () => {
    const stamp = new Date(2026, 10, 10, 9, 5).getTime();
    const rows: Baseline[] = [
      { id: 'a', name: 'OPPROF_20261108142517_QKWFPLXZVTRNBGMA', path: '/data/out.rep' },
      { id: 'b', name: 'gelu.npu-rep', path: '/data/gelu.npu-rep', pickedAt: stamp },
      { id: 'c', name: 'matmul warm-up', path: '/data/x.rep' },
    ];
    const wrapper = mount(BaselinePicker, {
      props: { baselines: [], pickBaselineFile: vi.fn().mockResolvedValue(null), recentBaselines: rows },
    });
    await open(wrapper);
    const names = rowNames();
    // Generated OPPROF name → the report filename + the stamp parsed from it.
    expect(names[0]).toBe('out.rep 2026-11-08 14:25');
    // A real name → kept, with its timestamp appended.
    expect(names[1]).toBe('gelu.npu-rep 2026-11-10 09:05');
    // A real name without a timestamp → kept as-is.
    expect(names[2]).toBe('matmul warm-up');
    wrapper.unmount();
  });

  it('PR-BASELINE-030: Browse prefers the pick mtime for pickedAt', async () => {
    const stamp = new Date(2026, 10, 5, 12, 30).getTime();
    const hook = vi.fn().mockResolvedValue({
      path: '/data/m.npu-rep',
      name: 'm.npu-rep',
      pickedAt: stamp,
    } satisfies BaselinePick);
    const wrapper = mountPicker({ pickBaselineFile: hook });
    await open(wrapper);
    await click('[data-testid="baseline-browse"]');
    await flushPromises();
    const appended = (wrapper.emitted('update:baselines')![0][0] as Baseline[])[0];
    expect(appended.pickedAt).toBe(stamp);
    wrapper.unmount();
  });
});
