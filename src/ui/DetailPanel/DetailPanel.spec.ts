import { describe, expect, it } from 'vitest';
import { mount } from '@vue/test-utils';
import DetailPanel from './DetailPanel.vue';
import type { DependencyNeighbors } from '../../domain/dependencies';
import { DOCK_HEIGHT_COLLAPSED, DOCK_HEIGHT_EXPANDED } from '../panelResize';

const selected = { id: '1', name: 'test_op', startTime: 100, duration: 100, endTime: 200 };

const neighbors: DependencyNeighbors = {
  incoming: [{ id: 'p1', name: 'ProfilerStep#1', startTime: 0 }],
  outgoing: [{ id: 's1', name: 'ProfilerStep#17', startTime: 300 }],
};

describe('DetailPanel', () => {
  it('PR-DPANEL-001: renders shell with summary', () => {
    const wrapper = mount(DetailPanel, {
      props: { selected },
    });

    expect(wrapper.find('[data-testid="detail-panel"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="detail-summary"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="detail-parameter"]').exists()).toBe(true);
    expect(wrapper.text()).toContain('test_op');
  });

  it('PR-DPANEL-002: close button emits close', async () => {
    const wrapper = mount(DetailPanel, {
      props: { selected },
    });

    await wrapper.find('[data-testid="detail-panel-close"]').trigger('click');
    expect(wrapper.emitted('close')).toHaveLength(1);
  });

  it('PR-DPANEL-003: Relevent column renders only with neighbors', () => {
    const without = mount(DetailPanel, { props: { selected } });
    expect(without.find('[data-testid="detail-relevant"]').exists()).toBe(false);
    expect(without.find('.pr-detail-panel__body').classes()).toContain(
      'pr-detail-panel__body--no-relevant',
    );

    const withDeps = mount(DetailPanel, {
      props: { selected, neighbors },
    });
    expect(withDeps.find('[data-testid="detail-relevant"]').exists()).toBe(true);
    expect(withDeps.find('.pr-detail-panel__body').classes()).not.toContain(
      'pr-detail-panel__body--no-relevant',
    );
    expect(withDeps.text()).toContain('ProfilerStep#17');
  });

  it('PR-DPANEL-004: forwards dependency mode updates', async () => {
    const wrapper = mount(DetailPanel, {
      props: { selected, neighbors, dependencyMode: 'all' },
    });

    // Depth lives in 显示控制 and drives the swimlane graph, not this column.
    expect(wrapper.find('[data-testid="detail-relevant-level"]').exists()).toBe(false);

    await wrapper
      .find('[data-testid="detail-relevant-direction-successors"]')
      .trigger('click');
    expect(wrapper.emitted('update:dependencyMode')?.[0]).toEqual(['successors']);
  });

  it('PR-DPANEL-005: the expander toggles the dock between its two sketch heights', async () => {
    const wrapper = mount(DetailPanel, { props: { selected } });
    const dock = wrapper.find('[data-testid="detail-panel"]');
    const expander = wrapper.find('[data-testid="detail-panel-expander"]');
    expect(expander.exists()).toBe(true);
    // The drag handle is gone: the dock has two heights, not a range.
    expect(wrapper.find('[data-testid="detail-panel-resize-handle"]').exists()).toBe(false);

    expect(dock.attributes('style')).toContain(`${DOCK_HEIGHT_COLLAPSED}px`);
    expect(expander.attributes('aria-expanded')).toBe('false');

    await expander.trigger('click');
    expect(wrapper.emitted('update:expanded')?.at(-1)).toEqual([true]);

    // Height is driven by the prop, so the parent owning the state is what moves it.
    await wrapper.setProps({ expanded: true });
    expect(dock.attributes('style')).toContain(`${DOCK_HEIGHT_EXPANDED}px`);
    expect(expander.attributes('aria-expanded')).toBe('true');

    await expander.trigger('click');
    expect(wrapper.emitted('update:expanded')?.at(-1)).toEqual([false]);
  });

  it('PR-DPANEL-006: the active tab underline sits on the header rule, not mid-header', async () => {
    const src = (await import('./DetailPanel.vue?raw')).default as string;
    // `align-items: center` floated the 2px underline in the middle of the 52px header;
    // stretching the row is what drops it onto the rule below.
    expect(src).toMatch(/\.pr-detail-panel__head\s*\{[^}]*align-items:\s*stretch/);
    expect(src).toMatch(/\.pr-detail-panel__head\s*\{[^}]*border-bottom:\s*1px solid/);
    expect(src).toMatch(/\.pr-detail-panel__tab\s*\{[^}]*border-bottom:\s*2px solid #fff/);
    expect(src).not.toMatch(/\.pr-detail-panel__tab\s*\{[^}]*padding-bottom/);
  });

  it('PR-DPANEL-007: dock height animates, and the close control is the design icon', async () => {
    const wrapper = mount(DetailPanel, { props: { selected } });
    expect(wrapper.find('[data-testid="detail-panel-close"] .pr-icon--close').exists()).toBe(true);

    const src = (await import('./DetailPanel.vue?raw')).default as string;
    expect(src).toMatch(/\.pr-detail-panel\s*\{[^}]*transition:\s*height/);
    // Cap against the viewport so a short host cannot lose the timeline on expand.
    expect(src).toMatch(/height:\s*min\(\s*var\(--pr-dock-h\),\s*60vh\s*\)/);
    // Enter/leave reuse that same transition so appearing never jumps the timeline.
    expect(src).toMatch(/\.pr-detail-panel\.pr-dock-enter-from[\s\S]*?height:\s*0/);
    expect(src).toMatch(/prefers-reduced-motion: reduce/);
  });
});
