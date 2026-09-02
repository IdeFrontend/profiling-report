import { describe, expect, it, afterEach, vi } from 'vitest';
import { mount, type VueWrapper } from '@vue/test-utils';
import { nextTick } from 'vue';
import ContextMenu from './ContextMenu.vue';
import type { SwimEvent } from '../../domain/types';

const makeEvent = (overrides: Partial<SwimEvent> = {}): SwimEvent => ({
  id: 'evt-1',
  name: 'test_op',
  startTime: 100,
  duration: 100,
  ...overrides,
});

/** Mount the menu with a hit-test payload (event or lane-only) and flush queue. */
function openMenu(
  propsOverride: Partial<{
    x: number;
    y: number;
    event: SwimEvent | null;
    laneId: string | null;
    dismissOnScroll: boolean;
    undoDepth: number;
    canResetZoom: boolean;
    offsetNs: number;
  }> = {},
): VueWrapper {
  return mount(ContextMenu, {
    props: {
      x: 200,
      y: 300,
      event: makeEvent(),
      laneId: 'lane-A',
      locale: 'zh-CN',
      ...propsOverride,
    },
    attachTo: document.body,
  });
}

function itemKeys(wrapper: VueWrapper): string[] {
  return wrapper
    .findAll('[data-testid^="context-menu-item-"]')
    .map((b) => b.attributes('data-testid')?.replace('context-menu-item-', '') ?? '');
}

describe('ContextMenu MVP', () => {
  afterEach(() => {
    document.body.innerHTML = '';
    vi.restoreAllMocks();
  });

  it('event-hit: renders fit / undo / reset / hide / show / offset (6 items)', async () => {
    const wrapper = openMenu();
    await nextTick();
    expect(itemKeys(wrapper)).toEqual([
      'fit-to-screen',
      'undo-zoom',
      'reset-zoom',
      'hide-lane',
      'show-in-event-view',
      'offset',
    ]);
  });

  it('lane-header-hit: hides event-only items (4 left)', async () => {
    const wrapper = openMenu({ event: null, laneId: 'lane-B' });
    await nextTick();
    expect(itemKeys(wrapper)).toEqual(['undo-zoom', 'reset-zoom', 'hide-lane', 'offset']);
  });

  it('Escape key dispatches close', async () => {
    const wrapper = openMenu();
    await nextTick();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    await nextTick();
    expect(wrapper.emitted('close')).toBeTruthy();
  });

  it('outside pointerdown dispatches close', async () => {
    const wrapper = openMenu();
    await nextTick();
    const ev = new PointerEvent('pointerdown', { bubbles: true });
    Object.defineProperty(ev, 'target', { value: document.body });
    document.dispatchEvent(ev);
    await nextTick();
    expect(wrapper.emitted('close')).toBeTruthy();
  });

  it('隐藏 emits hide-lane with laneId', async () => {
    const wrapper = openMenu();
    await nextTick();
    await wrapper.find('[data-testid="context-menu-item-hide-lane"]').trigger('click');
    expect(wrapper.emitted('hide-lane')).toEqual([['lane-A']]);
  });

  it('整屏显示 emits fit-to-screen with the event', async () => {
    const event = makeEvent({ id: 'evt-X' });
    const wrapper = openMenu({ event });
    await nextTick();
    await wrapper.find('[data-testid="context-menu-item-fit-to-screen"]').trigger('click');
    expect(wrapper.emitted('fit-to-screen')).toEqual([[event]]);
  });

  it('arrow keys move focus, Enter activates hide-lane (the 4th item)', async () => {
    const wrapper = openMenu();
    await nextTick();
    // Skip 整屏显示 (0) → 撤销缩放 (1, disabled but still focusable)
    // → 重置缩放 (2) → 隐藏 (3). Three ArrowDown presses to reach 隐藏.
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown' }));
    await nextTick();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown' }));
    await nextTick();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown' }));
    await nextTick();
    expect(document.activeElement?.getAttribute('data-testid')).toBe('context-menu-item-hide-lane');
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
    await nextTick();
    expect(wrapper.emitted('hide-lane')).toEqual([['lane-A']]);
  });

  it('right-edge hit opens leftward (clamp)', async () => {
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 1024 });
    Object.defineProperty(window, 'innerHeight', { configurable: true, value: 768 });
    Object.defineProperty(HTMLElement.prototype, 'offsetWidth', { configurable: true, value: 240 });
    Object.defineProperty(HTMLElement.prototype, 'offsetHeight', { configurable: true, value: 120 });
    const wrapper = openMenu({ x: 1000, y: 100 });
    await nextTick();
    await nextTick();
    const placement = wrapper.find('[data-testid="context-menu"]').attributes('data-placement');
    expect(placement).toBe('left-down');
  });

  it('window scroll dispatches close', async () => {
    const wrapper = openMenu({ dismissOnScroll: true });
    await nextTick();
    window.dispatchEvent(new Event('scroll'));
    await nextTick();
    expect(wrapper.emitted('close')).toBeTruthy();
  });

  it('在事件视图中显示 emits show-in-event-view', async () => {
    const event = makeEvent({ id: 'evt-Y' });
    const wrapper = openMenu({ event });
    await nextTick();
    await wrapper.find('[data-testid="context-menu-item-show-in-event-view"]').trigger('click');
    expect(wrapper.emitted('show-in-event-view')).toEqual([[event]]);
  });

  /* ----- Q24 (undo / reset) ----- */

  it('撤销缩放 is disabled when undoDepth = 0 and enabled at undoDepth > 0', async () => {
    const empty = openMenu({ undoDepth: 0 });
    await nextTick();
    const undoEmpty = empty.find('[data-testid="context-menu-item-undo-zoom"]');
    expect(undoEmpty.attributes('disabled')).toBeDefined();
    expect(undoEmpty.attributes('data-hint')).toBe('Ctrl+Z');

    const some = openMenu({ undoDepth: 3 });
    await nextTick();
    const undoSome = some.find('[data-testid="context-menu-item-undo-zoom"]');
    expect(undoSome.attributes('disabled')).toBeUndefined();
    expect(undoSome.attributes('data-hint')).toBe('Ctrl+Z (3)');
  });

  it('clicking 撤销缩放 emits undo-zoom (when enabled)', async () => {
    const wrapper = openMenu({ undoDepth: 2 });
    await nextTick();
    await wrapper.find('[data-testid="context-menu-item-undo-zoom"]').trigger('click');
    expect(wrapper.emitted('undo-zoom')).toBeTruthy();
  });

  it('clicking disabled 撤销缩放 does NOT emit', async () => {
    const wrapper = openMenu({ undoDepth: 0 });
    await nextTick();
    // Force-click on a disabled button — Vue still calls the handler unless
    // we guard inside. We guard with `if (item.disabled) return;`.
    await wrapper.find('[data-testid="context-menu-item-undo-zoom"]').trigger('click');
    expect(wrapper.emitted('undo-zoom')).toBeUndefined();
  });

  it('重置缩放 is disabled when canResetZoom = false', async () => {
    const wrapper = openMenu({ canResetZoom: false });
    await nextTick();
    const reset = wrapper.find('[data-testid="context-menu-item-reset-zoom"]');
    expect(reset.attributes('disabled')).toBeDefined();
  });

  it('clicking 重置缩放 emits reset-zoom', async () => {
    const wrapper = openMenu({ canResetZoom: true });
    await nextTick();
    await wrapper.find('[data-testid="context-menu-item-reset-zoom"]').trigger('click');
    expect(wrapper.emitted('reset-zoom')).toBeTruthy();
  });

  /* ----- Q25 (offset) ----- */

  it('Offset item emits set-offset', async () => {
    const wrapper = openMenu();
    await nextTick();
    await wrapper.find('[data-testid="context-menu-item-offset"]').trigger('click');
    expect(wrapper.emitted('set-offset')).toBeTruthy();
  });

  it('Offset hint shows the current offset in ns when set', async () => {
    const wrapper = openMenu({ offsetNs: 12345 });
    await nextTick();
    const offset = wrapper.find('[data-testid="context-menu-item-offset"]');
    expect(offset.attributes('data-hint')).toBe('12345 ns');
  });
});
