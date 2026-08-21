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
      mode: 'all',
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

  it('PR-DREL-002: direction buttons follow sketch order, mark the active mode and emit it', async () => {
    const wrapper = mountRelevant();

    expect(
      wrapper
        .findAll('.pr-detail-relevant__mode')
        .map((n) => n.attributes('data-testid')?.replace('detail-relevant-direction-', '')),
    ).toEqual(['predecessors', 'all', 'successors']);
    expect(
      wrapper.find('[data-testid="detail-relevant-direction-all"]').attributes('aria-pressed'),
    ).toBe('true');

    await wrapper
      .find('[data-testid="detail-relevant-direction-predecessors"]')
      .trigger('click');
    expect(wrapper.emitted('update:mode')?.[0]).toEqual(['predecessors']);

    // The walk does the filtering, so the column just renders what it is handed —
    // the suppressed side keeps its head and reads 0, so the grid does not reflow.
    const filtered = mountRelevant({
      mode: 'predecessors',
      neighbors: { incoming: neighbors.incoming, outgoing: [] },
    });
    expect(
      filtered
        .find('[data-testid="detail-relevant-direction-predecessors"]')
        .attributes('aria-pressed'),
    ).toBe('true');
    expect(filtered.find('[data-testid="detail-relevant-incoming-count"]').text()).toBe('2');
    expect(filtered.find('[data-testid="detail-relevant-outgoing-count"]').text()).toBe('0');
    expect(filtered.text()).not.toContain('ProfilerStep#17');
  });

  it('PR-DREL-004: shows the empty note when neither side has neighbours', () => {
    const wrapper = mountRelevant({ neighbors: { incoming: [], outgoing: [] } });

    expect(wrapper.find('[data-testid="detail-relevant-empty"]').exists()).toBe(true);
    // Direction buttons stay reachable so the user can widen the walk from empty.
    expect(wrapper.find('[data-testid="detail-relevant-direction-all"]').exists()).toBe(true);
  });

  it('PR-DREL-005: draws one connector curve per neighbour', () => {
    const wrapper = mountRelevant();
    const columns = wrapper.findAll('.pr-detail-relevant__links');

    expect(columns).toHaveLength(2);
    expect(columns[0].findAll('path')).toHaveLength(2);
    expect(columns[1].findAll('path')).toHaveLength(1);
    expect(columns[1].find('path').attributes('d')).toContain('C');
  });

  it('PR-DREL-006: each side sizes its connector svg to its own chip column', () => {
    // Lopsided on purpose: 5 in, 2 out. Sizing both svgs off the longer side stretched
    // the shorter one's viewBox, fanning its curves away from the chips they point at.
    const lopsided: DependencyNeighbors = {
      incoming: Array.from({ length: 5 }, (_, i) => ({ id: `p${i}`, name: `pred${i}`, startTime: i })),
      outgoing: Array.from({ length: 2 }, (_, i) => ({ id: `s${i}`, name: `succ${i}`, startTime: i })),
    };
    const columns = mountRelevant({ neighbors: lopsided }).findAll('.pr-detail-relevant__links');

    // n rows on CHIP_PITCH(26), less the gap the last row doesn't use: 5 -> 122, 2 -> 44.
    expect(columns[0].find('svg').attributes('height')).toBe('122');
    expect(columns[1].find('svg').attributes('height')).toBe('44');
    // The viewBox must match the height, or the stretch reappears silently.
    expect(columns[0].find('svg').attributes('viewBox')).toBe('0 0 32 122');
    expect(columns[1].find('svg').attributes('viewBox')).toBe('0 0 32 44');

    // Last curve on each side ends on its last chip's row centre (9 + i*26).
    const lastIn = columns[0].findAll('path').at(-1)!.attributes('d')!;
    expect(lastIn).toContain('M0 113');
    const lastOut = columns[1].findAll('path').at(-1)!.attributes('d')!;
    expect(lastOut).toContain('32 35');
  });

  it('PR-DREL-007: glyph dots stay smaller than the lattice pitch', () => {
    // The dots are round caps on zero-length segments, so stroke-width IS the dot
    // diameter. At 4.6 wide on a 4.6 pitch every dot touched its neighbour and each
    // tree rendered as one filled triangle instead of a node graph.
    const wrapper = mountRelevant();

    for (const button of wrapper.findAll('.pr-detail-relevant__mode')) {
      const [edges, dots] = button.findAll('path');
      const diameter = Number(dots.attributes('stroke-width'));

      // Every dot centre in the glyph, from its `M x y h0` segments.
      const centres = [...dots.attributes('d')!.matchAll(/M([\d.]+) ([\d.]+)h0/g)].map(
        ([, x, y]) => [Number(x), Number(y)] as const,
      );
      expect(centres.length).toBeGreaterThanOrEqual(5);

      let pitch = Infinity;
      for (const [i, a] of centres.entries()) {
        for (const b of centres.slice(i + 1)) {
          pitch = Math.min(pitch, Math.hypot(a[0] - b[0], a[1] - b[1]));
        }
      }
      // Sketch: 3.5px dots on a 5px lattice — a clear gap, not a hairline seam.
      expect(diameter).toBeLessThan(pitch);
      expect(pitch - diameter).toBeGreaterThanOrEqual(1);

      // Links read as connections behind the nodes, not as thick as them.
      expect(Number(edges.attributes('stroke-width'))).toBeLessThan(diameter);
      expect(Number(edges.attributes('stroke-opacity'))).toBeLessThan(1);
    }
  });
});
