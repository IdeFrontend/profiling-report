import { describe, expect, it } from 'vitest';
import { mount } from '@vue/test-utils';
import MemoryTopologyPanel from './MemoryTopologyPanel.vue';

const model = {
  nodes: [
    { id: 'gm', label: 'GM' },
    { id: 'l2', label: 'L2 Cache' },
    { id: 'cube', label: 'Cube' },
    { id: 'ub', label: 'UB' },
  ],
  edges: [
    { id: 'gm-l2-read', from: 'gm', to: 'l2', label: '1.56 GB/s' },
    { id: 'l2-ub', from: 'l2', to: 'ub', label: '0.00 GB/s' },
    { id: 'vec-ub', from: 'vec', to: 'ub', label: '0.10 GB/s' },
    { id: 'ub-vec', from: 'ub', to: 'vec', label: '0.20 GB/s' },
    { id: 'gm-l2-write', from: 'gm', to: 'l2' },
  ],
};

describe('MemoryTopologyPanel', () => {
  it('PR-MEMTOP-001: renders topology nodes', () => {
    const wrapper = mount(MemoryTopologyPanel, { props: { model } });
    expect(wrapper.find('[data-testid="memory-topology-panel"]').exists()).toBe(true);
    expect(wrapper.text()).toContain('L2 Cache');
    expect(wrapper.text()).toContain('Cube');
  });

  it('PR-MEMTOP-002: renders data-driven edge labels', () => {
    const wrapper = mount(MemoryTopologyPanel, { props: { model } });
    expect(wrapper.text()).toContain('1.56 GB/s');
    expect(wrapper.findAll('[data-testid="edge-vec-ub"]')).toHaveLength(2);
    expect(wrapper.findAll('[data-testid="edge-ub-vec"]')).toHaveLength(2);
  });

  it('PR-MEMTOP-003: omits NA/missing edge labels', () => {
    const wrapper = mount(MemoryTopologyPanel, { props: { model } });
    const gmWrite = wrapper.findAll('[data-testid="edge-gm-l2-write"]');
    expect(gmWrite.length).toBe(1);
    expect(gmWrite[0]!.text()).not.toContain('GB/s');
  });

  it('PR-MEMTOP-004: hides diagram when model empty', () => {
    const wrapper = mount(MemoryTopologyPanel, { props: { model: null } });
    expect(wrapper.find('[data-testid="memory-topology-panel"]').exists()).toBe(false);
  });

  it('PR-MEMTOP-005: edge labels update when model changes', async () => {
    const wrapper = mount(MemoryTopologyPanel, { props: { model } });
    expect(wrapper.text()).toContain('1.56 GB/s');
    await wrapper.setProps({
      model: {
        ...model,
        edges: [{ id: 'gm-l2-read', from: 'gm', to: 'l2', label: '9.99 GB/s' }],
      },
    });
    expect(wrapper.text()).toContain('9.99 GB/s');
    expect(wrapper.text()).not.toContain('1.56 GB/s');
  });

  it('PR-MEMTOP-006: edge labels sit in pillar corridors, not on GM/L2', () => {
    const wrapper = mount(MemoryTopologyPanel, {
      props: {
        model: {
          ...model,
          edges: [
            { id: 'gm-l2-read', from: 'gm', to: 'l2', label: '16.89 GB/s' },
            { id: 'l2-ub', from: 'l2', to: 'ub', label: '16.76 GB/s' },
            { id: 'l2-l1-read', from: 'l2', to: 'l1', label: '1.20 GB/s' },
          ],
        },
      },
    });
    const gm = wrapper.get('.pr-topo__gm');
    const l2 = wrapper.get('.pr-topo__l2');
    const cluster = wrapper.get('.pr-topo__cluster');
    const gmRight = Number(gm.attributes('x')) + Number(gm.attributes('width'));
    const l2Left = Number(l2.attributes('x'));
    const l2Right = l2Left + Number(l2.attributes('width'));
    const clusterLeft = Number(cluster.attributes('x'));

    const gmRead = wrapper.get('[data-testid="edge-gm-l2-read"]');
    const gmX = Number(gmRead.attributes('x'));
    expect(gmX).toBeGreaterThan(gmRight);
    expect(gmX).toBeLessThan(l2Left);
    expect(gmRead.attributes('transform') ?? '').toMatch(/rotate/);

    const l2ub = wrapper.get('[data-testid="edge-l2-ub"]');
    const ubX = Number(l2ub.attributes('x'));
    expect(ubX).toBeGreaterThan(l2Right);
    expect(ubX).toBeLessThan(clusterLeft);
    expect(l2ub.attributes('transform') ?? '').toMatch(/rotate/);

    const l2l1 = wrapper.get('[data-testid="edge-l2-l1-read"]');
    const l1X = Number(l2l1.attributes('x'));
    expect(l1X).toBeGreaterThan(l2Right);
    expect(l1X).toBeLessThan(clusterLeft);
    expect(l2l1.attributes('transform') ?? '').toMatch(/rotate/);
  });
});
