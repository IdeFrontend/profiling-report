import { describe, expect, it } from 'vitest';
import { mount } from '@vue/test-utils';
import DetailRelevant from './DetailRelevant.vue';
import type { DependencyNeighbors } from '../../../domain/dependencies';

const neighbors: DependencyNeighbors = {
  incoming: [
    { id: 'p1', name: 'ProfilerStep#1', startTime: 0 },
    { id: 'p2', name: 'ProfilerStep#2', startTime: 5 },
  ],
  outgoing: [{ id: 's1', name: 'ProfilerStep#17', startTime: 300 }],
};

function mountRelevant(props: Partial<Record<string, unknown>> = {}) {
  return mount(DetailRelevant, {
    props: {
      currentName: 'MOV_OUT_TO_L1_MULTI_ND2NZ',
      neighbors,
      level: -1,
      ...props,
    },
  });
}

describe('DetailRelevant', () => {
  it('PR-DREL-001: renders Relevant shell with columns and counts', () => {
    const wrapper = mountRelevant();

    expect(wrapper.find('[data-testid="detail-relevant"]').exists()).toBe(true);
    expect(wrapper.text()).toContain('Relevent');
    expect(wrapper.find('[data-testid="detail-relevant-incoming-count"]').text()).toBe('2');
    expect(wrapper.find('[data-testid="detail-relevant-outgoing-count"]').text()).toBe('1');
    expect(wrapper.text()).toContain('MOV_OUT_TO_L1_MULTI_ND2NZ');
    expect(wrapper.text()).toContain('ProfilerStep#17');
  });

  it('PR-DREL-002: direction buttons follow sketch order, mark the active one and filter the columns', async () => {
    const wrapper = mountRelevant();

    expect(
      wrapper
        .findAll('.pr-detail-relevant__mode')
        .map((n) => n.attributes('data-testid')?.replace('detail-relevant-direction-', '')),
    ).toEqual(['backward', 'both', 'forward']);
    expect(
      wrapper.find('[data-testid="detail-relevant-direction-both"]').attributes('aria-pressed'),
    ).toBe('true');

    await wrapper.find('[data-testid="detail-relevant-direction-backward"]').trigger('click');
    expect(
      wrapper.find('[data-testid="detail-relevant-direction-backward"]').attributes('aria-pressed'),
    ).toBe('true');
    expect(wrapper.find('[data-testid="detail-relevant-incoming-count"]').text()).toBe('2');
    // The suppressed side keeps its column and head, so the grid does not reflow.
    expect(wrapper.find('[data-testid="detail-relevant-outgoing-count"]').text()).toBe('0');
    expect(wrapper.text()).not.toContain('ProfilerStep#17');

    await wrapper.find('[data-testid="detail-relevant-direction-forward"]').trigger('click');
    expect(wrapper.find('[data-testid="detail-relevant-incoming-count"]').text()).toBe('0');
    expect(wrapper.find('[data-testid="detail-relevant-outgoing-count"]').text()).toBe('1');
  });

  it('PR-DREL-003: level input emits update:level as an integer', async () => {
    const wrapper = mountRelevant();
    const input = wrapper.find('[data-testid="detail-relevant-level"]');

    await input.setValue('3');
    await input.trigger('change');
    expect(wrapper.emitted('update:level')?.[0]).toEqual([3]);

    (input.element as HTMLInputElement).value = '';
    await input.trigger('change');
    expect(wrapper.emitted('update:level')?.at(-1)).toEqual([-1]);
  });

  it('PR-DREL-005: draws one connector curve per neighbour', () => {
    const wrapper = mountRelevant();
    const columns = wrapper.findAll('.pr-detail-relevant__links');

    expect(columns).toHaveLength(2);
    expect(columns[0].findAll('path')).toHaveLength(2);
    expect(columns[1].findAll('path')).toHaveLength(1);
    expect(columns[1].find('path').attributes('d')).toContain('C');
  });

  it('PR-DREL-004: shows the empty note when neither side has neighbours', () => {
    const wrapper = mountRelevant({ neighbors: { incoming: [], outgoing: [] } });

    expect(wrapper.find('[data-testid="detail-relevant-empty"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="detail-relevant-level"]').exists()).toBe(true);
  });
});
