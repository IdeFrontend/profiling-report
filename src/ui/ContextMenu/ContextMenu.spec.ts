import { describe, expect, it, afterEach } from 'vitest';
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

describe('ContextMenu MVP', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('event-hit: renders all three menu items', async () => {
    const wrapper = openMenu();
    await nextTick();
    const items = wrapper.findAll('[data-testid^="context-menu-item-"]');
    const keys = items.map(
      (b) => b.attributes('data-testid')?.replace('context-menu-item-', '') ?? '',
    );
    expect(keys).toEqual(['fit-to-screen', 'hide-lane', 'show-in-event-view']);
  });

  it('lane-header-hit: renders 隐藏 only', async () => {
    const wrapper = openMenu({ event: null, laneId: 'lane-B' });
    await nextTick();
    const items = wrapper.findAll('[data-testid^="context-menu-item-"]');
    const keys = items.map(
      (b) => b.attributes('data-testid')?.replace('context-menu-item-', '') ?? '',
    );
    expect(keys).toEqual(['hide-lane']);
  });

  it('Escape key dispatches close', async () => {
    const wrapper = openMenu();
    await nextTick();
    const ev = new KeyboardEvent('keydown', { key: 'Escape' });
    document.dispatchEvent(ev);
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

  it('arrow keys move focus, Enter activates', async () => {
    const wrapper = openMenu();
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
    // x=1000, vw=1024, w=240 → x+w > vw → flip left.
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
});
