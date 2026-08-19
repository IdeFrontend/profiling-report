import { describe, expect, it } from 'vitest';
import { mount } from '@vue/test-utils';
import DetailPanel from './DetailPanel.vue';
import type { DependencyNeighbors } from '../../domain/dependencies';

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

  it('PR-DPANEL-004: forwards level updates', async () => {
    const wrapper = mount(DetailPanel, {
      props: { selected, unit: 'ms', neighbors, level: -1 },
    });

    const input = wrapper.find('[data-testid="detail-relevant-level"]');
    await input.setValue('2');
    await input.trigger('change');
    expect(wrapper.emitted('update:level')?.[0]).toEqual([2]);
  });
});
