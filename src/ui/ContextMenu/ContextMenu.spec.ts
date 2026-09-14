import { afterEach, describe, expect, it, vi } from 'vitest';
import { mount, type VueWrapper } from '@vue/test-utils';
import ContextMenu from './ContextMenu.vue';
import type { SwimEvent } from '../../domain/types';

const event: SwimEvent = { id: 'ev1', name: 'op', startTime: 0, duration: 10 };

let wrapper: VueWrapper | null = null;

afterEach(() => {
  wrapper?.unmount();
  wrapper = null;
});

function menuItem(command: string) {
  return document.querySelector<HTMLButtonElement>(`[data-testid="ctx-item-${command}"]`);
}

describe('ContextMenu', () => {
  it('PR-CTXMENU-001: event menu groups available commands', async () => {
    wrapper = mount(ContextMenu, {
      props: {
        context: { x: 10, y: 10, laneId: 'lane1', target: event },
        pinnedLaneIds: [],
        canReset: true,
      },
      attachTo: document.body,
    });
    await wrapper.vm.$nextTick();
    expect(menuItem('reset')).not.toBeNull();
    expect(menuItem('show')).not.toBeNull();
    expect(menuItem('pin')).not.toBeNull();
    expect(document.querySelector('.pr-ctx-menu__sep')).not.toBeNull();
  });

  it('PR-CTXMENU-002: lane menu exposes available lane and viewport commands', async () => {
    wrapper = mount(ContextMenu, {
      props: {
        context: { x: 10, y: 10, laneId: 'lane1', target: null },
        pinnedLaneIds: [],
        canReset: true,
      },
      attachTo: document.body,
    });
    await wrapper.vm.$nextTick();
    expect(menuItem('reset')).not.toBeNull();
    expect(menuItem('show')).toBeNull();
    expect(menuItem('pin')).not.toBeNull();
    expect(document.querySelector('.pr-ctx-menu__sep')).not.toBeNull();
  });

  it('PR-CTXMENU-003: reset zoom is available without an event only outside the total range', async () => {
    wrapper = mount(ContextMenu, {
      props: {
        context: { x: 10, y: 10, laneId: 'lane1', target: null },
        pinnedLaneIds: [],
        canReset: true,
      },
      attachTo: document.body,
    });
    await wrapper.vm.$nextTick();
    expect(menuItem('reset')).not.toBeNull();
    menuItem('reset')!.click();
    expect(wrapper.emitted('action')?.[0]?.[0]).toEqual({ command: 'reset', laneId: 'lane1' });

    await wrapper.setProps({ canReset: false });
    await wrapper.vm.$nextTick();
    expect(menuItem('reset')).toBeNull();
  });

  it('PR-CTXMENU-004: show emits target event', async () => {
    wrapper = mount(ContextMenu, {
      props: { context: { x: 10, y: 10, laneId: 'lane1', target: event }, pinnedLaneIds: [] },
      attachTo: document.body,
    });
    await wrapper.vm.$nextTick();
    menuItem('show')!.click();
    expect(wrapper.emitted('action')?.[0]?.[0]).toEqual({
      command: 'show',
      laneId: 'lane1',
      target: event,
    });
  });

  it('PR-CTXMENU-005: pin toggles shared pin state and localizes the action', async () => {
    wrapper = mount(ContextMenu, {
      props: { context: { x: 10, y: 10, laneId: 'lane1', target: null }, pinnedLaneIds: [] },
      attachTo: document.body,
    });
    await wrapper.vm.$nextTick();
    expect(menuItem('pin')?.textContent).toContain('置顶行');
    menuItem('pin')!.click();
    expect(wrapper.emitted('action')?.[0]?.[0]).toEqual({ command: 'pin', laneId: 'lane1' });

    await wrapper.setProps({ pinnedLaneIds: ['lane1'] });
    await wrapper.vm.$nextTick();
    expect(menuItem('pin')?.textContent).toContain('取消置顶行');
    menuItem('pin')!.click();
    expect(wrapper.emitted('action')?.[1]?.[0]).toEqual({ command: 'pin', laneId: 'lane1' });
    expect(wrapper.emitted('dismiss')).toHaveLength(2);
  });

  it('PR-CTXMENU-013: pin row is omitted for a non-leaf (summary-bar) lane', async () => {
    wrapper = mount(ContextMenu, {
      props: {
        context: { x: 10, y: 10, laneId: 'folder', target: event },
        pinnedLaneIds: [],
        canPin: false,
        canReset: true,
      },
      attachTo: document.body,
    });
    await wrapper.vm.$nextTick();
    expect(menuItem('reset')).not.toBeNull();
    expect(menuItem('show')).not.toBeNull();
    expect(menuItem('pin')).toBeNull();
    expect(document.querySelectorAll('.pr-ctx-menu__sep')).toHaveLength(1);
  });

  it('PR-CTXMENU-006: deferred commands remain absent', async () => {
    wrapper = mount(ContextMenu, {
      props: { context: { x: 10, y: 10, laneId: 'lane1', target: event }, pinnedLaneIds: [] },
      attachTo: document.body,
    });
    await wrapper.vm.$nextTick();
    expect(menuItem('undo')).toBeNull();
    expect(menuItem('hide')).toBeNull();
    expect(menuItem('offset')).toBeNull();
  });

  it('PR-CTXMENU-007: viewport clamp uses the rendered menu dimensions and re-clamps on resize', async () => {
    const originalW = window.innerWidth;
    const originalH = window.innerHeight;
    Object.defineProperty(window, 'innerWidth', { value: 300, configurable: true });
    Object.defineProperty(window, 'innerHeight', { value: 200, configurable: true });
    // Mock getBoundingClientRect globally so place() reads real dimensions (250×113) on first call.
    const spy = vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({
      x: 0, y: 0, top: 0, right: 250, bottom: 113, left: 0, width: 250, height: 113,
      toJSON: () => ({}),
    });
    wrapper = mount(ContextMenu, {
      props: { context: { x: 290, y: 199, laneId: 'lane1', target: event }, pinnedLaneIds: [] },
      attachTo: document.body,
    });
    await wrapper.vm.$nextTick();
    let style = document.querySelector('.pr-ctx-menu')?.getAttribute('style') ?? '';
    let leftMatch = style.match(/left:\s*(-?\d+)px/);
    let topMatch = style.match(/top:\s*(-?\d+)px/);
    expect(leftMatch).not.toBeNull();
    expect(topMatch).not.toBeNull();
    expect(Number(leftMatch![1])).toBeGreaterThanOrEqual(4);
    expect(Number(topMatch![1])).toBeGreaterThanOrEqual(4);
    expect(Number(leftMatch![1]) + 250).toBeLessThanOrEqual(296);
    expect(Number(topMatch![1]) + 113).toBeLessThanOrEqual(196);

    Object.defineProperty(window, 'innerWidth', { value: 260, configurable: true });
    Object.defineProperty(window, 'innerHeight', { value: 160, configurable: true });
    window.dispatchEvent(new Event('resize'));
    await wrapper.vm.$nextTick();
    style = document.querySelector('.pr-ctx-menu')?.getAttribute('style') ?? '';
    leftMatch = style.match(/left:\s*(-?\d+)px/);
    topMatch = style.match(/top:\s*(-?\d+)px/);
    expect(Number(leftMatch![1]) + 250).toBeLessThanOrEqual(256);
    expect(Number(topMatch![1]) + 113).toBeLessThanOrEqual(156);

    spy.mockRestore();
    Object.defineProperty(window, 'innerWidth', { value: originalW, configurable: true });
    Object.defineProperty(window, 'innerHeight', { value: originalH, configurable: true });
  });

  it('PR-CTXMENU-008: dismisses on outside click, Escape, and viewport scroll', async () => {
    wrapper = mount(ContextMenu, {
      props: { context: { x: 10, y: 10, laneId: 'lane1', target: null }, pinnedLaneIds: [] },
      attachTo: document.body,
    });
    await wrapper.vm.$nextTick();
    document.body.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
    expect(wrapper.emitted('dismiss')).toHaveLength(1);

    await wrapper.setProps({ context: { x: 10, y: 10, laneId: 'lane1', target: null } });
    await wrapper.vm.$nextTick();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(wrapper.emitted('dismiss')).toHaveLength(2);

    await wrapper.setProps({ context: { x: 10, y: 10, laneId: 'lane1', target: null } });
    await wrapper.vm.$nextTick();
    window.dispatchEvent(new Event('scroll'));
    expect(wrapper.emitted('dismiss')).toHaveLength(3);
  });

  it('PR-CTXMENU-009: keyboard navigation focuses and activates the next event command', async () => {
    wrapper = mount(ContextMenu, {
      props: {
        context: { x: 10, y: 10, laneId: 'lane1', target: event },
        pinnedLaneIds: [],
        canReset: true,
      },
      attachTo: document.body,
    });
    await wrapper.vm.$nextTick();
    expect(document.activeElement).toBe(document.querySelector('[data-testid="context-menu"]'));
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown' }));
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
    expect(wrapper.emitted('action')?.[0]?.[0]).toEqual({ command: 'show', laneId: 'lane1', target: event });
  });

  it('PR-CTXMENU-010: Alt+P activates pin only when Pin row is available', async () => {
    wrapper = mount(ContextMenu, {
      props: { context: { x: 10, y: 10, laneId: 'lane1', target: null }, pinnedLaneIds: [] },
      attachTo: document.body,
    });
    await wrapper.vm.$nextTick();
    const ev = new KeyboardEvent('keydown', { key: 'P', altKey: true, cancelable: true });
    document.dispatchEvent(ev);
    expect(ev.defaultPrevented).toBe(true);
    expect(wrapper.emitted('action')?.[0]?.[0]).toEqual({ command: 'pin', laneId: 'lane1' });

    await wrapper.setProps({ context: { x: 10, y: 10, laneId: 'folder', target: event }, canPin: false });
    await wrapper.vm.$nextTick();
    const unavailable = new KeyboardEvent('keydown', { key: 'p', altKey: true, cancelable: true });
    document.dispatchEvent(unavailable);
    expect(unavailable.defaultPrevented).toBe(false);
    expect(wrapper.emitted('action')).toHaveLength(1);
  });

  it('PR-CTXMENU-014: does not render a menu when no commands are available', async () => {
    wrapper = mount(ContextMenu, {
      props: { context: { x: 10, y: 10, laneId: 'folder', target: null }, pinnedLaneIds: [], canPin: false },
      attachTo: document.body,
    });
    await wrapper.vm.$nextTick();
    expect(document.querySelector('[data-testid="context-menu"]')).toBeNull();
  });
});
