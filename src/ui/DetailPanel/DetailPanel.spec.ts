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
      props: { selected, timeDisplayMode: 'time' as const },
    });

    expect(wrapper.find('[data-testid="detail-panel"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="detail-summary"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="detail-parameter"]').exists()).toBe(true);
    expect(wrapper.text()).toContain('test_op');
  });

  it('PR-DPANEL-002: close button emits close', async () => {
    const wrapper = mount(DetailPanel, {
      props: { selected, timeDisplayMode: 'time' as const },
    });

    await wrapper.find('[data-testid="detail-panel-close"]').trigger('click');
    expect(wrapper.emitted('close')).toHaveLength(1);
  });

  it('PR-DPANEL-003: Relevent column renders only with neighbors', () => {
    const without = mount(DetailPanel, {
      props: { selected, timeDisplayMode: 'time' as const },
    });
    expect(without.find('[data-testid="detail-relevant"]').exists()).toBe(false);
    expect(without.find('.pr-detail-panel__body').classes()).toContain(
      'pr-detail-panel__body--no-relevant',
    );

    const withDeps = mount(DetailPanel, {
      props: { selected, timeDisplayMode: 'time' as const, neighbors },
    });
    expect(withDeps.find('[data-testid="detail-relevant"]').exists()).toBe(true);
    expect(withDeps.find('.pr-detail-panel__body').classes()).not.toContain(
      'pr-detail-panel__body--no-relevant',
    );
    expect(withDeps.text()).toContain('ProfilerStep#17');
  });

  it('PR-DPANEL-004: forwards dependency mode updates', async () => {
    const wrapper = mount(DetailPanel, {
      props: {
        selected,
        timeDisplayMode: 'time' as const,
        neighbors,
        dependencyMode: 'all',
      },
    });

    // Depth lives in 显示控制 and drives the swimlane graph, not this column.
    expect(wrapper.find('[data-testid="detail-relevant-level"]').exists()).toBe(false);

    await wrapper
      .find('[data-testid="detail-relevant-direction-successors"]')
      .trigger('click');
    expect(wrapper.emitted('update:dependencyMode')?.[0]).toEqual(['successors']);
  });

  it('PR-DPANEL-005: the expander toggles the dock between its two sketch heights', async () => {
    const wrapper = mount(DetailPanel, {
      props: { selected, timeDisplayMode: 'time' as const },
    });
    const expander = wrapper.find('[data-testid="detail-panel-expander"]');
    expect(expander.exists()).toBe(true);
    // The drag handle is gone: the dock has two heights, not a range.
    expect(wrapper.find('[data-testid="detail-panel-resize-handle"]').exists()).toBe(false);

    expect(expander.attributes('aria-expanded')).toBe('false');

    await expander.trigger('click');
    expect(wrapper.emitted('update:height')?.at(-1)).toEqual([DOCK_HEIGHT_EXPANDED]);

    // Height is driven by the prop, so the parent owning the state is what moves it.
    await wrapper.setProps({ height: DOCK_HEIGHT_EXPANDED });
    expect(expander.attributes('aria-expanded')).toBe('true');

    await expander.trigger('click');
    expect(wrapper.emitted('update:height')?.at(-1)).toEqual([DOCK_HEIGHT_COLLAPSED]);
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

  it('PR-DPANEL-007: the close control is the design icon and the shell lives in the parent', async () => {
    const wrapper = mount(DetailPanel, { props: { selected, timeDisplayMode: 'time' as const } });
    expect(wrapper.find('[data-testid="detail-panel-close"].pr-close').exists()).toBe(true);

    const src = (await import('./DetailPanel.vue?raw')).default as string;
    // The panel is a content shell now: height, border and transition are owned by the parent dock.
    expect(src).not.toMatch(/\.pr-detail-panel\s*\{[^}]*height:\s*min\(\s*var\(--pr-dock-h\),\s*60vh\s*\)/);
    expect(src).not.toMatch(/\.pr-detail-panel\.pr-dock-enter-from/);
  });
});
