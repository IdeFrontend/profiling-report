import { describe, expect, it } from 'vitest';
import { mount } from '@vue/test-utils';
import DetailPanel from './DetailPanel.vue';
import type { DependencyNeighbors } from '../../domain/dependencies';
import { DOCK_HEIGHT_MIN } from '../panelResize';

const selected = { id: '1', name: 'test_op', startTime: 100, duration: 100, endTime: 200 };

const neighbors: DependencyNeighbors = {
  incoming: [{ id: 'p1', name: 'ProfilerStep#1', startTime: 0 }],
  outgoing: [{ id: 's1', name: 'ProfilerStep#17', startTime: 300 }],
};

describe('DetailPanel', () => {
  it('PR-DPANEL-001: renders shell with summary', () => {
    const wrapper = mount(DetailPanel, {
      props: { selected, unit: 'ms' },
    });

    expect(wrapper.find('[data-testid="detail-panel"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="detail-summary"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="detail-parameter"]').exists()).toBe(true);
    expect(wrapper.text()).toContain('test_op');
  });

  it('PR-DPANEL-002: close button emits close', async () => {
    const wrapper = mount(DetailPanel, {
      props: { selected, unit: 'ms' },
    });

    await wrapper.find('[data-testid="detail-panel-close"]').trigger('click');
    expect(wrapper.emitted('close')).toHaveLength(1);
  });

  it('PR-DPANEL-003: Relevent column renders only with neighbors', () => {
    const without = mount(DetailPanel, { props: { selected, unit: 'ms' } });
    expect(without.find('[data-testid="detail-relevant"]').exists()).toBe(false);
    expect(without.find('.pr-detail-panel__body').classes()).toContain(
      'pr-detail-panel__body--no-relevant',
    );

    const withDeps = mount(DetailPanel, {
      props: { selected, unit: 'ms', neighbors },
    });
    expect(withDeps.find('[data-testid="detail-relevant"]').exists()).toBe(true);
    expect(withDeps.find('.pr-detail-panel__body').classes()).not.toContain(
      'pr-detail-panel__body--no-relevant',
    );
    expect(withDeps.text()).toContain('ProfilerStep#17');
  });

  it('PR-DPANEL-004: forwards dependency mode and depth updates', async () => {
    const wrapper = mount(DetailPanel, {
      props: { selected, unit: 'ms', neighbors, dependencyMode: 'all', dependencyDepth: -1 },
    });

    const input = wrapper.find('[data-testid="detail-relevant-level"]');
    await input.setValue('2');
    await input.trigger('change');
    expect(wrapper.emitted('update:dependencyDepth')?.[0]).toEqual([2]);

    await wrapper
      .find('[data-testid="detail-relevant-direction-successors"]')
      .trigger('click');
    expect(wrapper.emitted('update:dependencyMode')?.[0]).toEqual(['successors']);
  });

  it('PR-DPANEL-005: dragging the top edge up grows the dock', async () => {
    const wrapper = mount(DetailPanel, { props: { selected, unit: 'ms', height: 247 } });
    const handle = wrapper.find('[data-testid="detail-panel-resize-handle"]');
    expect(handle.exists()).toBe(true);
    expect(wrapper.find('[data-testid="detail-panel"]').attributes('style')).toContain('247px');

    await handle.trigger('pointerdown', { button: 0, clientY: 800 });
    await handle.trigger('pointermove', { clientY: 700 });
    // Up 100px on the top edge = 100px taller.
    expect(wrapper.emitted('update:height')?.at(-1)).toEqual([347]);

    await handle.trigger('pointermove', { clientY: 900 });
    expect(wrapper.emitted('update:height')?.at(-1)).toEqual([147]);

    // Past the floor it clamps rather than collapsing.
    await handle.trigger('pointermove', { clientY: 4000 });
    expect(wrapper.emitted('update:height')?.at(-1)).toEqual([DOCK_HEIGHT_MIN]);

    // After pointerup the drag is over: further moves emit nothing.
    const before = wrapper.emitted('update:height')?.length ?? 0;
    await handle.trigger('pointerup');
    await handle.trigger('pointermove', { clientY: 100 });
    expect(wrapper.emitted('update:height')?.length ?? 0).toBe(before);
  });
});
